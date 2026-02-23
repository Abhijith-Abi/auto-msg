const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const express = require("express");
const fs = require("fs");

// --- 1. Railway Sleep Prevention & Health Check Server ---
const app = express();
const port = process.env.PORT || 3001;

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
// CRITICAL FIX: Removed --single-process flag which breaks message events in WhatsApp Web
// Clean any stale session data before initializing the client
if (fs.existsSync("./.wwebjs_auth")) {
    try {
        fs.rmSync("./.wwebjs_auth", { recursive: true, force: true });
        console.log("[Bot] Cleared old session folder .wwebjs_auth");
    } catch (e) {
        console.error("[Bot] Failed to clear session folder:", e);
    }
}

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot-session",
        dataPath: "./.wwebjs_auth",
    }),
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
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

client.on("ready", async () => {
    isAuthenticated = true;
    qrCodeDataUrl = null;
    console.log("[Bot] Successfully authenticated and ready!");
    console.log("[Bot] Message listeners are active. Waiting for messages...");
    try {
        const chats = await client.getChats();
        console.log(`[Bot] Loaded ${chats.length} chats after ready.`);
    } catch (e) {
        console.error("[Bot] Error loading chats on ready:", e);
    }
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

// --- 4. Message Listener ---
const TARGET_TEXT = "is anyone willing to take current shift";
const TARGET_GROUP_NAME = "Testt";
let lastProcessedMessageId = null;

// Use message_create which fires for ALL messages (incoming + outgoing)
// The 'message' event sometimes doesn't fire on certain whatsapp-web.js versions
client.on("message_create", async (msg) => {
    try {
        // Log EVERY message for debugging
        console.log(
            `[MSG] from=${msg.from} fromMe=${msg.fromMe} type=${msg.type} body="${msg.body?.substring(0, 50)}"`,
        );

        // 🚫 Ignore own messages
        if (msg.fromMe) return;

        // 🚫 Ignore non-group chats
        if (!msg.from.endsWith("@g.us")) return;

        const text = msg.body?.toLowerCase() || "";

        // ⚡ Check text match first (fast path)
        if (!text.includes(TARGET_TEXT)) return;

        console.log(`[Bot] 🎯 Target text matched! Checking group name...`);

        const chat = await msg.getChat();
        const groupName = chat.name?.trim();
        console.log(
            `[Bot] Group name: "${groupName}" (expected: "${TARGET_GROUP_NAME}")`,
        );

        if (groupName !== TARGET_GROUP_NAME) {
            console.log(`[Bot] ❌ Wrong group, ignoring.`);
            return;
        }

        // Prevent duplicate replies
        if (msg.id._serialized === lastProcessedMessageId) return;
        lastProcessedMessageId = msg.id._serialized;

        console.log(`[${new Date().toISOString()}] 🚀 SHIFT MESSAGE DETECTED!`);
        await msg.reply("Ok");
        console.log(`[Bot] ✅ Replied "Ok" successfully!`);
    } catch (error) {
        console.error("[Bot] Error:", error);
    }
});

// Fallback listener for older versions where 'message' fires but 'message_create' may not
client.on("message", async (msg) => {
    // Reuse the same logic as message_create
    try {
        console.log(
            `[MSG] from=${msg.from} fromMe=${msg.fromMe} type=${msg.type} body="${msg.body?.substring(0, 50)}"`,
        );
        if (msg.fromMe) return;
        if (!msg.from.endsWith("@g.us")) return;
        const text = msg.body?.toLowerCase() || "";
        if (!text.includes(TARGET_TEXT)) return;
        const chat = await msg.getChat();
        const groupName = chat.name?.trim();
        if (groupName !== TARGET_GROUP_NAME) return;
        if (msg.id._serialized === lastProcessedMessageId) return;
        lastProcessedMessageId = msg.id._serialized;
        await msg.reply("Ok");
        console.log(`[Bot] ✅ Replied "Ok" via fallback listener`);
    } catch (e) {
        console.error("[Bot] Fallback listener error:", e);
    }
});

// --- 5. Initialize Client ---
console.log("[Bot] Starting WhatsApp client...");
client.initialize();
