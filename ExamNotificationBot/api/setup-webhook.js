/* ====================================================================
   SETUP WEBHOOK — Visit this URL once in your browser after deploying
   URL: https://<your-vercel-url>/api/setup-webhook
   ==================================================================== */

const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = 'https';
  const webhookUrl = `${protocol}://${host}/api/notify`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message'],
          drop_pending_updates: true,
        }),
      }
    );
    const result = await response.json();

    if (result.ok) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Webhook Set Successfully</title>
            <style>
              body { font-family: sans-serif; padding: 40px; background: #f0fdf4; color: #166534; line-height: 1.6; }
              .card { background: #ffffff; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; max-width: 540px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
              code { background: #dcfce7; padding: 3px 8px; border-radius: 4px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>✅ Webhook Set Successfully!</h2>
              <p><b>Webhook URL:</b><br/><code>${webhookUrl}</code></p>
              <p>Your Page Learning Telegram Bot is now live and listening for updates at this endpoint.</p>
              <p>You can close this tab and send <code>/start</code> to your bot on Telegram!</p>
            </div>
          </body>
        </html>
      `);
    } else {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Webhook Setup Failed</title></head>
          <body style="font-family: sans-serif; padding: 40px; background: #fef2f2; color: #991b1b;">
            <h2>❌ Webhook Setup Failed</h2>
            <pre>${JSON.stringify(result, null, 2)}</pre>
          </body>
        </html>
      `);
    }
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
