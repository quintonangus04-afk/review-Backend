/* ---------------------------------------------
   SEND REVIEW EMAIL (manual trigger from admin)
---------------------------------------------- */
app.post("/send-review-email", async (req, res) => {
  const { token, name, email } = req.body;

  if (!token || !email) {
    return res.status(400).json({ error: "Token and email are required." });
  }

  // Build the same link the customer will use
  const link = `https://thecousingroup.co.uk/reviews/?token=${token}`;

  try {
    await axios.post(
      `${process.env.EMAILURLVALUE}/send-relay`,
      {
        to: email,
        subject: "Please leave a review",
        message: `Hi ${name || "there"},\n\nWe would appreciate your feedback!\n\nPlease leave your review here:\n${link}\n\nThank you,\nThe Cousin Group team`
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

