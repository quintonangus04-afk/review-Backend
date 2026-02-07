const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
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
   EMAIL TRANSPORTER (Fasthosts / Livemail)
   - Works on Railway
   - Uses STARTTLS on port 587
   - TLS override required for Railway
---------------------------------------------- */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.livemail.co.uk",
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Required for Railway + Fasthosts
  }
});

/* ---------------------------------------------
   FUNCTION: Send automated reply email
---------------------------------------------- */
function sendReplyEmail(to, name) {
  if (!to) return Promise.resolve(); // Skip if no email provided

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: to,
    subject: "Thank you for your review",
    text: `Hi ${name || "there"},\n\nThank you for leaving a review. We appreciate your feedback!\n\nBest regards,\nThe Cousin Group Printing`
  };

  return transporter.sendMail(mailOptions)
    .catch(err => console.error("Email send error:", err));
}

/* ---------------------------------------------
   ROUTE: Save a new review + send email
---------------------------------------------- */
app.post("/review", (req, res) => {
  const { name, email, rating, comments } = req.body;

  if (!rating || !comments) {
    return res.status(400).send("Rating and comments are required.");
  }

  const sql = `
    INSERT INTO reviews (name, email, rating, comments, date_submitted)
    VALUES (?, ?, ?, ?, NOW())
  `;

  db.query(sql, [name || null, email || null, rating, comments], async (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Failed to save review.");
    }

    // Send automated reply email
    await sendReplyEmail(email, name);

    res.send("Thank you! Your review has been saved.");
  });
});

/* ---------------------------------------------
   TEMPORARY ROUTE:
   Send emails to ALL existing reviewers
   - Visit once, then delete this route
---------------------------------------------- */
app.get("/send-all-review-emails", async (req, res) => {
  const sql = "SELECT name, email FROM reviews";

  db.query(sql, async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error loading reviews.");
    }

    for (const r of results) {
      await sendReplyEmail(r.email, r.name);
    }

    res.send("Emails sent to all previous reviewers.");
  });
});

/* ---------------------------------------------
   ROUTE: Display all reviews in HTML
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
