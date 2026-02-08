const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const axios = require("axios");

const app = express();

/* ---------------------------------------------
   CORS
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
   DATABASE CONNECTION
---------------------------------------------- */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

/* ---------------------------------------------
   SEND REVIEW EMAIL (manual trigger)
---------------------------------------------- */
app.post("/send-review-email", async (req, res) => {
  const { token, name, email } = req.body;

  if (!token || !email) {
    return res.status(400).json({ error: "Token and email are required." });
  }

  const link = `https://thecousingroup.co.uk/reviews/?token=${token}`;

  try {
    await axios.post(
      `${process.env.EMAILURLVALUE}/send-relay`,
      {
        to: email,
        name,
        subject: "Please leave a review",
        message: `Hi ${name || "there"},\n\nWe would appreciate your feedback!\n\nPlease leave your review here:\n${link}\n\nThank you,\nThe Cousin Group Printing`
      },
      {
        headers: {
          "x-relay-secret": process.env.EMAIL_RELAY_SECRET
        }
      }
    );

    res.json({ message: "Email sent successfully." });
  } catch (err) {
    console.error("Send email error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to send email." });
  }
});

/* ---------------------------------------------
   EXISTING ROUTES (generate link, validate, review)
---------------------------------------------- */
// keep all your existing routes here (unchanged)

/* ---------------------------------------------
   START SERVER
---------------------------------------------- */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
