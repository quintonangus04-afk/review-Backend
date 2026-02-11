app.post("/generate-review-link", async (req, res) => {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const token = Math.random().toString(36).substring(2, 12);

  const sql = `
    INSERT INTO review_tokens (token, email, name)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [token, email, name || null], async (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create token" });
    }

    const link = `https://thecousingroup.co.uk/reviews/?token=${token}`;

    // SEND EMAIL HERE (instead of a separate endpoint)
    try {
      await axios.post(
        `${process.env.EMAILURLVALUE}/send-relay`,
        {
          to: email,
          name,
          subject: "Please leave a review",
          message: `Hi ${name || "there"},\n\nPlease leave your review here:\n${link}\n\nThank you,\nThe Cousin Group Team`
        },
        {
          headers: {
            "x-relay-secret": process.env.EMAIL_RELAY_SECRET
          }
        }
      );
    } catch (err) {
      console.error("Email send failed:", err.response?.data || err.message);
    }

    res.json({ link });
  });
});
