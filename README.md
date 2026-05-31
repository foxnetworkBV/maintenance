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

## Discord Bot (Optional)

1. Create a Discord bot application and copy its token.
2. Set the `DISCORD_BOT_TOKEN` environment variable:

   - macOS / Linux:
     ```bash
     export DISCORD_BOT_TOKEN="your_token"
     ```
   - Windows PowerShell:
     ```powershell
     $env:DISCORD_BOT_TOKEN="your_token"
     ```

3. Run the bot:
   ```bash
   npm run start-bot
   ```

4. Use these commands in a server where the bot is present. You must have `Manage Server` permissions:

   - `!status 75` — update progress percentage
   - `!step 2 current Bezig` — set step 2 as current with a detail message
   - `!label Ontwikkelingsstatus` — change the status label
   - `!show` — display the current site status
   - `!reset` — restore the default statuses

The webpage loads status data from `status.json` automatically.

## Files

- `index.html` - Main page (safe to share)
- `styles.css` - Styling (safe to share)
- `config.js` - Client configuration (safe to share)
- `script.js` - Client logic (safe to share)
- `notify.php` - PHP backend with webhook URL (⚠️ KEEP PRIVATE)
- `server.js` - Node.js backend alternative (⚠️ KEEP PRIVATE)

**Important:** Never commit `notify.php` or `server.js` with your webhook URL to public repositories!
