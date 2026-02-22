const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const express = require("express");

// --- 1. Railway Sleep Prevention & Health Check Server ---
// Railway needs a web service to bind to a PORT. This prevents sleep/crashes.
const app = express();
const port = process.env.PORT || 3000;

let qrCodeDataUrl = null;
let isAuthenticated = false;

app.get("/", (req, res) => res.send("WhatsApp Auto-Reply Bot is Active 24/7!"));
app.get("/ping", (req, res) => res.send("pong"));

app.get("/qr", (req, res) => {
    if (isAuthenticated) {
        return res.send(`
            <html>
                <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;background-color:#f0f2f5;">
                    <div style="text-align:center;padding:40px;background:white;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                        <h2 style="color:#25d366;margin:0;">✅ Bot is already authenticated!</h2>
                        <p style="color:#666;margin-top:10px;">No QR code needed. Close this page.</p>
                    </div>
                </body>
            </html>
        `);
    }

    if (!qrCodeDataUrl) {
        return res.send(`
            <html>
                <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;background-color:#f0f2f5;">
                    <div style="text-align:center;padding:40px;background:white;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                        <h2 style="color:#333;margin:0;">⏳ QR Code is generating...</h2>
                        <p style="color:#666;margin-top:10px;">Please wait a few seconds and refresh this page.</p>
                    </div>
                </body>
            </html>
        `);
    }

    res.send(`
        <html>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background-color:#f0f2f5;">
                <div style="text-align:center;padding:30px;background:white;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                    <h2 style="font-family:sans-serif;color:#333;margin-top:0;">Scan WhatsApp QR Code</h2>
                    <img src="${qrCodeDataUrl}" alt="QR Code" style="width:300px;height:300px;border:1px solid #eee;border-radius:10px;padding:10px;"/>
                    <p style="font-family:sans-serif;color:#666;font-size:14px;margin-bottom:0;">(Refresh page if QR code has expired)</p>
                </div>
            </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`[Server] Health check server listening on port ${port}`);
});

// --- 2. Production Puppeteer & Client Setup ---
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot-session",
        dataPath: "./.wwebjs_auth", // Safer session handling with explicit path
    }),
    puppeteer: {
        headless: true, // Headless requirement
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu",
        ],
    },
});

// --- 3. Client Event Handlers ---
client.on("qr", async (qr) => {
    if (!qrCodeDataUrl) {
        console.log(
            "🤖 QR CODE RECEIVED! Open your browser and navigate to /qr to scan the QR Image.",
        );
    }
    try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
    } catch (err) {
        console.error("Failed to generate QR code image", err);
    }
});

client.on("ready", () => {
    isAuthenticated = true;
    qrCodeDataUrl = null;
    console.log("[Bot] Successfully authenticated and ready!");
});

client.on("authenticated", () => {
    isAuthenticated = true;
    console.log("[Bot] Session authenticated and saved securely.");
});

client.on("auth_failure", (msg) => {
    isAuthenticated = false;
    console.error("[Bot] Authentication failure:", msg);
});

// Auto-reconnect & Error Handling
client.on("disconnected", (reason) => {
    isAuthenticated = false;
    qrCodeDataUrl = null;
    console.log("[Bot] Client disconnected. Reason:", reason);
    console.log("[Bot] Attempting to reconnect...");
    // Slight delay before reconnecting to prevent rapid crash loops
    setTimeout(() => {
        client
            .initialize()
            .catch((err) => console.error("Reconnection failed:", err));
    }, 5000);
});

// Avoid crashes from unhandled errors
process.on("unhandledRejection", (error) => {
    console.error("Unhandled Promise Rejection:", error);
});

// --- 4. Ultra-Fast Optimized Message Listener ---
const TARGET_TEXT = "is anyone willing to take current shift";
let lastProcessedMessageId = null;

client.on("message", async (msg) => {
    try {
        console.log(
            `[DEBUG message] text: "${msg.body}", fromMe: ${msg.fromMe}, from: ${msg.from}, isGroup: ${msg.from.endsWith("@g.us")}`,
        );

        // 🚫 Ignore own messages instantly (important for speed + no loops)
        if (msg.fromMe) return;

        // 🚫 Ignore non-group chats instantly
        if (!msg.from.endsWith("@g.us")) return;

        // 🚫 Ignore already processed message
        if (msg.id._serialized === lastProcessedMessageId) return;

        const text = msg.body?.toLowerCase() || "";

        // ⚡ FAST STRING MATCH (case insensitive)
        if (text.includes(TARGET_TEXT)) {
            lastProcessedMessageId = msg.id._serialized;

            console.log(
                `[${new Date().toISOString()}] 🚀 SHIFT MESSAGE DETECTED`,
            );

            await msg.reply("Ok");

            console.log(`[Bot] ✅ Replied instantly.`);
        }
    } catch (error) {
        console.error("[Bot] Error while handling incoming message:", error);
    }
});

client.on("message_create", async (msg) => {
    try {
        console.log(
            `[DEBUG message_create] text: "${msg.body}", fromMe: ${msg.fromMe}, from: ${msg.from}, isGroup: ${msg.from.endsWith("@g.us")}`,
        );

        // 🚫 Ignore own messages instantly (important for speed + no loops)
        if (msg.fromMe) return;

        // 🚫 Ignore non-group chats instantly
        if (!msg.from.endsWith("@g.us")) return;

        // 🚫 Ignore already processed message
        if (msg.id._serialized === lastProcessedMessageId) return;

        const text = msg.body?.toLowerCase() || "";

        // ⚡ FAST STRING MATCH (case insensitive)
        if (text.includes(TARGET_TEXT)) {
            lastProcessedMessageId = msg.id._serialized;

            console.log(
                `[${new Date().toISOString()}] 🚀 SHIFT MESSAGE DETECTED`,
            );

            await msg.reply("Ok");

            console.log(`[Bot] ✅ Replied instantly.`);
        }
    } catch (error) {
        console.error("[Bot] Error while handling incoming message:", error);
    }
});

// --- 5. Initialize Client ---
console.log("[Bot] Starting WhatsApp client...");
client.initialize();
