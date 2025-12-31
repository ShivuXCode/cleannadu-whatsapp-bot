# Cleannadu WhatsApp Bot

A state-based conversational WhatsApp bot for filing and tracking cleanliness complaints. Built with Node.js, Express, and Twilio.

## Features

✨ **Multi-language Support** - Tamil, English, and Hindi
🔄 **State Management** - Conversation flow tracking per user
📸 **Media Support** - Accept images, location, voice notes, and text
🆔 **Complaint Tracking** - Sequential ID generation (CLN-000001)
📊 **Status Tracking** - Track complaint status by ID
🚀 **Production Ready** - Deployable on Render with zero code changes

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Add your Twilio credentials to `.env`:
   - `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
   - `PORT` - Server port (default: 3000)

4. Run the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Twilio WhatsApp Sandbox Configuration

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Messaging → Try it out → Send a WhatsApp message
3. Follow the instructions to join your WhatsApp Sandbox
4. Configure the webhook URL to: `https://your-domain.com/whatsapp`

## Bot Commands

**Language Selection:**
- 1️⃣ Tamil (தமிழ்)
- 2️⃣ English
- 3️⃣ Hindi (हिंदी)

**Main Menu:**
- 1️⃣ File a complaint
- 2️⃣ Track complaint

**Filing a Complaint:**
- Send 📸 Image of unclean location
- Send 📍 Live location
- Send 📝 Text address
- Send 🎤 Voice note
- Send 🖼️ Image with address text

**Tracking:**
- Enter complaint ID (e.g., CLN-000001)

## API Endpoints

- `GET /` - Health check endpoint
- `POST /whatsapp` - WhatsApp webhook endpoint (configured in Twilio)

## Conversation Flow

```
User sends any message
    ↓
Language Selection (Tamil/English/Hindi)
    ↓
Main Menu (File Complaint / Track Complaint)
    ↓
┌─────────────────────┬──────────────────────┐
│  File Complaint     │  Track Complaint     │
│                     │                      │
│  1. Send location   │  1. Enter ID         │
│     (image/GPS/     │  2. View status      │
│      text/voice)    │  3. Back to menu     │
│  2. Get CLN-XXXXXX  │                      │
│  3. Back to menu    │                      │
└─────────────────────┴──────────────────────┘
```

## Data Storage

Currently using **in-memory storage** for:
- User sessions (state, language, data)
- Complaints (ID, user, location, status, date)

**For production**, extend to:
- MongoDB for persistence
- Redis for session management
- AWS S3/Cloudinary for media storage

## Deploy to Render

1. Push your code to GitHub (without .env file)
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure the service:
   - **Name**: cleannadu-whatsapp-bot
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add Environment Variables:
   - `TWILIO_ACCOUNT_SID` → Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN` → Your Twilio Auth Token
   - `PORT` → Leave empty (Render sets this automatically)
7. Click "Create Web Service"
8. Once deployed, copy your Render URL (e.g., `https://your-app.onrender.com`)
9. Update Twilio webhook to: `https://your-app.onrender.com/whatsapp`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID from console | Yes |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token from console | Yes |
| `PORT` | Server port (auto-set by Render) | No (default: 3000) |

⚠️ **Never commit .env file to Git** - it's already in .gitignore

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your Twilio credentials

# Start server
npm start

# Or use nodemon for auto-reload
npm run dev
```

## Testing with Twilio Sandbox

1. Join sandbox: Send WhatsApp message to Twilio number with join code
2. For local testing, use [ngrok](https://ngrok.com/):
   ```bash
   ngrok http 3000
   ```
3. Copy ngrok URL and set as webhook in Twilio: `https://xyz.ngrok.io/whatsapp`
4. Send messages to test the bot
