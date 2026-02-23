const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const express = require("express");

// ─── HTTP health-check server (required by Railway) ────────────────────────
const app = express();
const PORT = process.env.PORT || 8080;

let qrDataUrl = null;
let botReady = false;

app.get("/", (_req, res) => res.send("WhatsApp Auto-Reply Bot is running!"));
app.get("/ping", (_req, res) => res.send("pong"));
app.get("/qr", (_req, res) => {
    if (botReady)
        return res.send(
            "<h2 style='font-family:sans-serif;color:green'>✅ Bot is authenticated. No QR needed.</h2>",
        );
    if (!qrDataUrl)
        return res.send(
            "<h2 style='font-family:sans-serif'>⏳ QR generating… refresh in a few seconds.</h2>",
        );
    res.send(
        `<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f2f5"><div style="text-align:center;padding:30px;background:#fff;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.12)"><h2 style="font-family:sans-serif;margin-top:0">Scan with WhatsApp</h2><img src="${qrDataUrl}" style="width:300px;height:300px"/><p style="font-family:sans-serif;color:#888;font-size:13px">Refresh if expired</p></div></body></html>`,
    );
});
app.listen(PORT, "0.0.0.0", () => console.log(`[Server] Listening on port ${PORT}`));

// ─── WhatsApp client ────────────────────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot",
        dataPath: "/tmp/.wwebjs_auth",
    }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium" || undefined,
            process.env.PUPPETEER_EXECUTABLE_PATH ||
            "/run/current-system/sw/bin/chromium" ||
            undefined,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
    },
});

// ─── Events ─────────────────────────────────────────────────────────────────
client.on("qr", async (qr) => {
    console.log("[Bot] QR received – visit /qr to scan.");
    try {
        qrDataUrl = await qrcode.toDataURL(qr);
    } catch (e) {
        console.error(e);
    }
});

client.on("authenticated", () => console.log("[Bot] Authenticated."));

client.on("ready", () => {
    botReady = true;
    qrDataUrl = null;
    console.log("[Bot] Ready and listening for messages.");
});

client.on("auth_failure", (msg) => console.error("[Bot] Auth failure:", msg));

client.on("disconnected", (reason) => {
    botReady = false;
    console.log("[Bot] Disconnected:", reason, "– reconnecting in 10 s…");
    setTimeout(() => client.initialize().catch(console.error), 10000);
});

// ─── Auto-reply logic ────────────────────────────────────────────────────────
const TARGET = "is anyone willing to take current shift";
const GROUP = "Testt"; // exact group name
const REPLY = "Ok";
let lastId = null;

async function handleMessage(msg) {
    // basic guards
    if (msg.fromMe) return;
    if (!msg.from.endsWith("@g.us")) return;

    const body = (msg.body || "").toLowerCase();
    if (!body.includes(TARGET)) return;
    if (msg.id._serialized === lastId) return;

    // verify group
    let groupName = "";
    try {
        const chat = await msg.getChat();
        groupName = (chat.name || "").trim();
    } catch (e) {
        console.error("[Bot] getChat error:", e.message);
        return;
    }

    console.log(`[Bot] Message in "${groupName}" matches target text.`);

    if (groupName !== GROUP) {
        console.log(`[Bot] Skipping – not "${GROUP}".`);
        return;
    }

    lastId = msg.id._serialized;
    try {
        await msg.reply(REPLY);
        console.log(`[Bot] Replied "${REPLY}" in ${GROUP}.`);
    } catch (e) {
        console.error("[Bot] Reply failed:", e.message);
    }
}

// Both events to maximise coverage
client.on("message", handleMessage);
client.on("message_create", handleMessage);

// ─── Start ───────────────────────────────────────────────────────────────────
process.on("unhandledRejection", (e) =>
    console.error("[Bot] Unhandled rejection:", e),
);
console.log("[Bot] Starting…");
client.initialize();
