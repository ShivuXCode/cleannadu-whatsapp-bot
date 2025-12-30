require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "cleannadu_verify_token";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = "913127778552733";

// Health check route
app.get("/", (req, res) => {
    res.send("CleanNadu WhatsApp Bot is running 🚀");
});

// Webhook verification (GET)
app.get("/webhook", (req, res) => {
    try {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("✅ Webhook verified successfully");
            res.status(200).send(challenge);
        } else {
            console.error("❌ Webhook verification failed");
            res.sendStatus(403);
        }
    } catch (error) {
        console.error("❌ Error in webhook verification:", error.message);
        res.sendStatus(500);
    }
});

// Receive messages (POST)
app.post("/webhook", async (req, res) => {
    try {
        console.log("📩 Webhook hit");
        console.log("Incoming request body:");
        console.log(JSON.stringify(req.body, null, 2));

        // Safely extract the message
        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (!message) {
            console.log("⚠️ No message found in webhook payload");
            return res.sendStatus(200);
        }

        const from = message.from;
        console.log(`📱 Message from: ${from}`);

        const reply = "👋 Welcome to CleanNadu!\n\n1️⃣ English\n2️⃣ தமிழ்\n3️⃣ हिंदी\n\nReply with 1, 2 or 3.";

        // Send WhatsApp reply
        await axios.post(
            `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: from,
                text: { body: reply },
            },
            {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log(`✅ Reply sent to ${from}`);
        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error processing webhook:", error.response?.data || error.message);
        res.sendStatus(500);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 CleanNadu WhatsApp Bot server running on port ${PORT}`);
});
