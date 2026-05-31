// Simple backend server to protect webhook URL
// Run with: node server.js

const express = require('express');
const path = require('path');
const app = express();
const PORT = 1029;

// Your secret webhook URL (keep this file private!)
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1301189616241610814/R8hRiJIxmiRGX3P-QJ8vmGRQBYk9sOoHVIrMHZHQHDBUjCBRAQb4h1CiBZ8bui50fyH2';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API endpoint to handle email notifications
app.post('/api/notify', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content: `📧 New maintenance notification request: ${email}` 
      })
    });

    if (response.ok) {
      res.json({ success: true, message: 'Notification sent successfully' });
    } else {
      throw new Error('Discord webhook failed');
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
