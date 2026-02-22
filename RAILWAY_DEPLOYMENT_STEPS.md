# Railway Deployment Steps

Follow these instructions to deploy your production-ready WhatsApp Auto-Reply Bot to Railway!

## Prerequisites

1. A GitHub account.
2. A Railway account (https://railway.app/).
3. A smartphone with WhatsApp installed to scan the QR code.

## Step 1: Push Code to GitHub

First, you need to turn this directory into a Git repository and push it to GitHub.
Run the following commands in your terminal:

```bash
cd /Users/abi/Documents/Me/Dev/whatsapp/Railware
git init
echo "node_modules/\n.wwebjs_auth/" > .gitignore
git add .
git commit -m "Initial commit for WhatsApp Auto-Reply Bot"
```

Then, create a new repository on GitHub and push this code to it.

## Step 2: Deploy to Railway

1. Go to your Railway Dashboard.
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select the repository you just created.
4. **Important Settings:**
   Railway will automatically use Nixpacks to build this app. Because `puppeteer` is in our `package.json`, Nixpacks will automatically download Google Chrome and set the environment variable.

## Step 3: Authenticate the Bot

The first time the bot runs, it needs to scan a QR code to link your WhatsApp account.

1. In your Railway dashboard, click on your deployed project.
2. Click on the **Deployments** tab and then **View Logs**.
3. Wait until you see the QR code printed in the logs.
4. Quickly open WhatsApp on your phone -> Settings -> **Linked Devices** -> **Link a Device**.
5. Scan the QR code shown in the Railway terminal logs.
6. Once authenticated, you will see `[Bot] Session authenticated and saved securely.` in the logs.

Because we used `LocalAuth` and a `.wwebjs_auth` data path, the session will be saved to Railway's persistent storage if configured, or just locally in the container.

### ⚠️ IMPORTANT: Persistent Session Setup on Railway

Since Railway containers are ephemeral (they reset on redeploy), you need to attach a **Volume** to persist your WhatsApp session so you don't have to scan the QR code every time.

1. In Railway, go to your service settings.
2. Under **Volumes**, click **Add Volume**.
3. Set the Mount Path to `/.wwebjs_auth` (or `/app/.wwebjs_auth` based on your workspace).
4. Save and Redeploy. The authentication session is now completely safe and permanent!

## Step 4: Railway Sleep Prevention

If you are using the Developer/Hobby plan, Railway might put your app to sleep. We've included an Express Health Check server to prevent this!

1. Go to your Railway Service Settings -> **Networking**.
2. Click **Generate Domain**.
3. Copy the domain (e.g., `https://whatsapp-bot-production.up.railway.app`).
4. Go to a free service like [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com).
5. Create a new HTTP monitor pointing to your URL (e.g., `https://whatsapp-bot-production.up.railway.app/ping`).
6. Set the interval to **5 minutes**.
   This will ping the bot every 5 minutes forever, keeping the Railway container wide awake 24/7!

## Optimizations Included

👉 **Faster Trigger Detection:** We now check the exact text string _before_ we make any network calls (like `msg.getChat()`). Unrelated messages are skipped instantly without any overhead.
👉 **Auto-Reconnect:** If the bot gets disconnected, it will automatically wait 5 seconds and initialize again, preventing crash-loops.
👉 **Safer Session:** We explicitly set `dataPath: './.wwebjs_auth'` for the LocalAuth directory, making it easy to map to a Railway Volume.
👉 **Sleep Prevention Server:** Included an Express endpoint that serves HTTP requests so Railway officially recognizes it as a healthy web server.
