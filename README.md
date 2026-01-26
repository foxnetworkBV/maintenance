# Maintenance Page

A secure maintenance page with email notifications sent to Discord.

## Setup for Plesk (PHP)

1. Upload all files to your Plesk hosting
2. Make sure `notify.php` contains your webhook URL (keep private)
3. Set `index.html` as your maintenance/503 error page
4. Done! Works immediately with PHP on Plesk

## Setup for Node.js (Alternative)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Update the webhook URL in `server.js` (keep this file private)

3. Run the server:
   ```bash
   npm start
   ```

## Files

- `index.html` - Main page (safe to share)
- `styles.css` - Styling (safe to share)
- `config.js` - Client configuration (safe to share)
- `script.js` - Client logic (safe to share)
- `notify.php` - PHP backend with webhook URL (⚠️ KEEP PRIVATE)
- `server.js` - Node.js backend alternative (⚠️ KEEP PRIVATE)

**Important:** Never commit `notify.php` or `server.js` with your webhook URL to public repositories!
