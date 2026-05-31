// Simple backend server to protect webhook URL
// Run with: node server.js

const path = require('path');
const { fork } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const app = express();
const PORT = 1029;

// Your secret webhook URL (keep this file private!)
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

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
  console.log('Starting discord-bot.js as a child process...');

  const botPath = path.resolve(__dirname, 'discord-bot.js');
  const botProcess = fork(botPath, [], {
    env: process.env,
    cwd: __dirname,
    stdio: 'inherit'
  });

  botProcess.on('error', (error) => {
    console.error('Discord bot process error:', error);
  });

  botProcess.on('exit', (code, signal) => {
    console.log(`Discord bot process exited with code ${code} signal ${signal}`);
  });
});
