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

// --- 4. Main Message Listener (Optimized for Speed) ---
// Using "message" instead of "message_create" ensures we only listen to incoming messages.
client.on("message", async (msg) => {
    try {
        const text = msg.body?.trim();
        const targetText = "Is anyone willing to take current shift?";

        // ✨ FASTER TRIGGER DETECTION ✨
        // We do the exact string match BEFORE doing expensive async calls like msg.getChat()
        // This ensures the bot instantly ignores 99.9% of messages.
        if (text !== targetText) {
            return;
        }

        const chat = await msg.getChat();

        // Only react if the message was sent in a Group
        if (!chat.isGroup) {
            return;
        }

        console.log(
            `[${new Date().toISOString()}] Target message detected in group "${chat.name}"!`,
        );

        // Instant reply
        await msg.reply("Ok");
        console.log(`[Bot] Replied "Ok" successfully.`);
    } catch (error) {
        console.error("[Bot] Error while handling incoming message:", error);
    }
});

// --- 5. Initialize Client ---
console.log("[Bot] Starting WhatsApp client...");
client.initialize();
