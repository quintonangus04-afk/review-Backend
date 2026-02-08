const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const axios = require("axios");

const app = express();

/* ---------------------------------------------
   CORS (allow your domain only)
---------------------------------------------- */
app.use(cors({
  origin: [
    "https://thecousingroup.co.uk",
    "https://www.thecousingroup.co.uk"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

/* ---------------------------------------------
   DATABASE CONNECTION (Railway MySQL)
---------------------------------------------- */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

/* ---------------------------------------------
   FUNCTION: Relay email to Google Cloud
---------------------------------------------- */
async function relayEmail(to, name) {
  if (!to) return;

  try {
    await axios.post(
      `${process.env.EMAILURLVALUE}/send-relay`,
      {
        to,
        subject: "Thank you for your review",
        message: `Hi ${name || "there"},\n\nThank you for leaving a review. We appreciate your feedback!\n\nBest regards,\nThe Cousin Group team`
      },
      {
        headers: {
          "x-relay-secret": process.env.EMAIL_RELAY_SECRET
        }
      }
    );

    console.log("Relay email success");
  } catch (err) {
    console.error("Relay email error:", err.response?.data || err.message);
  }
}

/* ---------------------------------------------
   TOKEN SYSTEM
---------------------------------------------- */

/* Generate a review link */
app.post("/generate-review-link", (req, res) => {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const token = Math.random().toString(36).substring(2, 12);

  const sql = `
    INSERT INTO review_tokens (token, email, name)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [token, email, name || null], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create token" });
    }

    const link = `https://thecousingroup.co.uk/reviews/?token=${token}`;
    res.json({ link });
  });
});

/* Validate token */
app.get("/review-token/:token", (req, res) => {
  const { token } = req.params;

  const sql = `
    SELECT * FROM review_tokens
    WHERE token = ? AND used = 0
  `;

  db.query(sql, [token], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.json({ valid: false });
    }

    res.json({ valid: true });
  });
});

/* ---------------------------------------------
   SUBMIT REVIEW (token required)
---------------------------------------------- */
app.post("/review", (req, res) => {
  const { token, rating, comments } = req.body;

  if (!token || !rating || !comments) {
    return res.status(400).json({ error: "Token, rating and comments are required." });
  }

  const tokenSql = `
    SELECT * FROM review_tokens
    WHERE token = ? AND used = 0
  `;

  db.query(tokenSql, [token], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (results.length === 0) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    const { email, name } = results[0];

    const reviewSql = `
      INSERT INTO reviews (name, email, rating, comments, date_submitted)
      VALUES (?, ?, ?, ?, NOW())
    `;

    db.query(reviewSql, [name, email, rating, comments], async (err) => {
      if (err) return res.status(500).json({ error: "Failed to save review." });

      db.query("UPDATE review_tokens SET used = 1 WHERE token = ?", [token]);

      await relayEmail(email, name);

      res.json({ message: "Thank you! Your review has been saved." });
    });
  });
});

/* ---------------------------------------------
   PUBLIC REVIEW LIST PAGE
---------------------------------------------- */
app.get("/", (req, res) => {
  const sql = "SELECT * FROM reviews ORDER BY date_submitted DESC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error loading reviews.");
    }

    let html = `
      <h1>Customer Reviews – The Cousin Group Printing</h1>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .review {
          background: white;
          border: 1px solid #ddd;
          padding: 15px;
          margin-bottom: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .rating { font-size: 18px; color: #f5a623; }
        .meta { color: #666; font-size: 13px; margin-bottom: 8px; }
      </style>
    `;

    results.forEach(r => {
      html += `
        <div class="review">
          <div class="meta">
            <strong>${r.name || "Anonymous"}</strong>
            ${r.email ? `(${r.email})` : ""}
            <br>
            <small>${r.date_submitted}</small>
          </div>
          <div class="rating">${"⭐".repeat(r.rating)}</div>
          <p>${r.comments}</p>
        </div>
      `;
    });

    res.send(html);
  });
});

/* ---------------------------------------------
   START SERVER
---------------------------------------------- */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

