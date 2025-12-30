const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "cleannadu_verify_token"; // same token you will put in Meta
const ACCESS_TOKEN = "23MI VPQ3 MOGT M75G TQ27 E3MF YD22 4TOS"; // temporary token
const PHONE_NUMBER_ID = "913127778552733";

// 1️⃣ WEBHOOK VERIFICATION (GET)
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2️⃣ RECEIVE MESSAGES (POST)
app.post("/webhook", async (req, res) => {
    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const message = changes?.value?.messages?.[0];

        if (message) {
            const from = message.from;
            const text = message.text?.body?.toLowerCase();

            let reply = "👋 Welcome to CleanNadu!\n\n1️⃣ English\n2️⃣ தமிழ்\n3️⃣ हिंदी\n\nReply with 1, 2 or 3.";

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
        }

        res.sendStatus(200);
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.sendStatus(500);
    }
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
