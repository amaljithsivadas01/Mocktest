# Page Learning Exam Results Telegram Bot

A serverless Telegram Bot built for Page Learning that notifies subscribed instructors/administrators with student names and final marks in real time whenever an exam is submitted.

---

## Features

- **Real-Time Results Alert**: Delivers Student Name, Exam Title, Department, Final Marks, Percentage, and Duration in real time.
- **Subscriber Management**: Secure subscription with access password (`2012`).
- **Free-of-Cost Storage**: Pre-configured for Upstash Redis's free-forever tier (10,000 commands/day, 256MB free, no credit card required).
- **Zero Heavy Dependencies**: Pure Node.js with native HTTP requests, optimized for instant Vercel Serverless execution.

---

## Free Storage Comparison & Setup

### Recommended: Upstash Redis (Free Forever)
1. Visit [console.upstash.com](https://console.upstash.com) and sign up for free (no credit card needed).
2. Click **Create Database** (Select any region, e.g. AWS / eu-central-1 or ap-southeast-1).
3. Under the **REST API** section, copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Paste them into your `.env` file or Vercel Environment Variables.
> Upstash's Free Plan grants 10,000 commands daily — more than enough for thousands of exam alerts.

### Alternative Free Options:
- **Cloudflare KV**: 100k free reads/day, 1k writes/day.
- **Supabase Postgres**: 500MB free database with REST API.
- **Firebase Realtime DB**: 1GB storage free forever.

---

## Deployment to Vercel

### Step 1: Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
cd C:\Projects\ExamNotificationBot
vercel
```
Follow the prompts to link or create a new project.

### Step 3: Set Environment Variables in Vercel
In the Vercel Dashboard, go to **Settings > Environment Variables** and add:

| Name | Value |
|---|---|
| `BOT_TOKEN` | (Stored in `.env` — your Telegram Bot token from @BotFather) |
| `UPSTASH_REDIS_REST_URL` | (From your free Upstash console) |
| `UPSTASH_REDIS_REST_TOKEN` | (From your free Upstash console) |
| `SUBSCRIBE_PASSWORD` | `2012` |

Then trigger a redeploy (`vercel --prod`).

### Step 4: Register the Telegram Webhook
Open your browser and visit:
```
https://<your-vercel-deployment-url>/api/setup-webhook
```
You will see a green **Webhook Set Successfully** confirmation!

### Step 5: Test the Bot on Telegram
1. Open your bot on Telegram.
2. Send `/start`.
3. When prompted, enter password `2012`.
4. The bot will confirm your subscription!

---

## Bot Commands

| Command | Action |
|---|---|
| `/start` | Prompts for password to subscribe |
| `/start 2012` | Instantly subscribes if correct password |
| `/unsubscribe` | Removes you from the notification list |
| `/status` | Displays the count of active subscribers |

---

## Google Apps Script Integration
1. Open your Google Form or linked Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Paste the contents of `appscript.gs`.
4. Replace `BOT_WEBHOOK_URL` with:
   ```javascript
   var BOT_WEBHOOK_URL = "https://<your-vercel-deployment-url>/api/notify";
   ```
5. Create an **On form submit** trigger.
