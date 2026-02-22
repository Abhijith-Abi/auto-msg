const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");

// --- 1. Railway Sleep Prevention & Health Check Server ---
// Railway needs a web service to bind to a PORT. This prevents sleep/crashes.
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("WhatsApp Auto-Reply Bot is Active 24/7!"));
app.get("/ping", (req, res) => res.send("pong"));

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
client.on("qr", (qr) => {
    console.log("\n======================================================");
    console.log("🤖 QR CODE RECEIVED!");
    console.log("Scan this QR code with your WhatsApp app to log in:");
    qrcode.generate(qr, { small: true });
    console.log("======================================================\n");
});

client.on("ready", () => {
    console.log("[Bot] Successfully authenticated and ready!");
});

client.on("authenticated", () => {
    console.log("[Bot] Session authenticated and saved securely.");
});

client.on("auth_failure", (msg) => {
    console.error("[Bot] Authentication failure:", msg);
});

// Auto-reconnect & Error Handling
client.on("disconnected", (reason) => {
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
const TARGET_TEXT = "is anyone willing to take current shift?";
let lastProcessedMessageId = null;

client.on("message", async (msg) => {
    try {
        // 🚫 Ignore own messages instantly (important for speed + no loops)
        if (msg.fromMe) return;

        // 🚫 Ignore non-group chats instantly
        if (!msg.from.endsWith("@g.us")) return;

        // 🚫 Ignore already processed message
        if (msg.id._serialized === lastProcessedMessageId) return;

        const text = msg.body?.trim().toLowerCase();

        // ⚡ FAST STRING MATCH (case insensitive)
        if (text === TARGET_TEXT) {
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
        // 🚫 Ignore own messages instantly (important for speed + no loops)
        if (msg.fromMe) return;

        // 🚫 Ignore non-group chats instantly
        if (!msg.from.endsWith("@g.us")) return;

        // 🚫 Ignore already processed message
        if (msg.id._serialized === lastProcessedMessageId) return;

        const text = msg.body?.trim().toLowerCase();

        // ⚡ FAST STRING MATCH (case insensitive)
        if (text === TARGET_TEXT) {
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
