# CleanNadu WhatsApp Bot

An advanced state-based conversational WhatsApp bot for civic cleanliness complaint management. Built with Node.js, Express, and Twilio with intelligent intent detection and fuzzy matching.

## Features

🌐 **Multi-language Support** - Tamil, English, Hindi with fuzzy matching
🤖 **Global Commands** - Work anytime, in any state (language change, file, track, exit)
🔄 **State Management** - Robust per-user conversation tracking
🧠 **Intent Detection** - Fuzzy matching handles typos (e.g., "englidh" → English)
📸 **Media Support** - Images, GPS location, voice notes, text addresses
🆔 **Sequential IDs** - Auto-generated complaint tracking (CLN-000001)
📊 **Status Tracking** - Track complaint status by ID with validation
🎯 **Persistent UI** - Language selector visible in every response
🚀 **Production Ready** - Modular, extensible, deployment-ready

## Global Commands (Work Anywhere)

These commands work **at any time**, regardless of conversation state:

### Language Change
Type any variation (with typos):
- `tamil`, `tamizh`, `taml`, `1`
- `english`, `eng`, `englidh`, `2`  
- `hindi`, `indi`, `hind`, `3`

Bot will ask: *"Did you mean English? Reply YES or NO"*

### Complaint Actions
- **File**: `file`, `complaint`, `register`, `new`
- **Track**: `track`, `status`, `check`
- **Exit**: `exit`, `quit`, `cancel`, `stop`

## Conversation Flow

```
User sends any message
    ↓
Language Selection (with fuzzy matching)
    ↓
Main Menu (always accessible)
    ↓
┌─────────────────────────────┬───────────────────────┐
│  1. File Complaint          │  2. Track Complaint   │
│                             │                       │
│  → Send image/location/     │  → Enter CLN-XXXXXX   │
│     text/voice              │  → Validate format    │
│  → Get CLN-000001           │  → Show status        │
│  → Return to menu           │  → Return to menu     │
└─────────────────────────────┴───────────────────────┘
                    ↓
        3. Exit → Reset to menu
                    ↓
    🌐 Language: 1️⃣ Tamil | 2️⃣ English | 3️⃣ Hindi
    (Always visible, always clickable)
```

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

## Bot Interaction Examples

**Example 1: Language change mid-conversation**
```
User: "englidh" (typo)
Bot: "Did you mean English? Reply YES or NO"
User: "yes"
Bot: "✅ Language changed to English

📋 Please select an option:
1️⃣ File a cleanliness complaint
2️⃣ Track complaint status
3️⃣ Exit

🌐 Language: 1️⃣ Tamil | 2️⃣ English | 3️⃣ Hindi"
```

**Example 2: Filing complaint with GPS**
```
User: "1" (File complaint)
Bot: "📸 Please send an image of the unclean location..."
User: [Sends live location]
Bot: "✅ Your complaint has been registered!
🆔 Complaint ID: CLN-000001
📊 Status: Pending

📋 Please select an option:
1️⃣ File a cleanliness complaint
2️⃣ Track complaint status
3️⃣ Exit

🌐 Language: 1️⃣ Tamil | 2️⃣ English | 3️⃣ Hindi"
```

**Example 3: Global command**
```
User: "track" (while in any state)
Bot: "🔍 Please enter your complaint ID (e.g., CLN-000001)

🌐 Language: 1️⃣ Tamil | 2️⃣ English | 3️⃣ Hindi"
```

## API Endpoints

- `GET /` - Health check endpoint
- `POST /whatsapp` - WhatsApp webhook endpoint (configured in Twilio)

## Architecture Highlights

### Intent Detection System
- **Fuzzy Matching**: Handles typos using Levenshtein distance algorithm
- **Pattern Recognition**: Detects language and command intent from natural language
- **Multi-pattern Support**: Each intent has multiple keywords including regional variations

### State Management
- **Per-user Sessions**: Isolated state tracking via WhatsApp number
- **Interrupt Handling**: Global commands don't break conversation flow
- **State Recovery**: Can resume previous state after language confirmation

### Message Structure
```javascript
{
  welcome: "Greeting + Language selector",
  menu: "Options + Language selector",
  responses: "Content + Language selector"
}
```
**Every message** ends with:
```
🌐 Language: 1️⃣ Tamil | 2️⃣ English | 3️⃣ Hindi
```

### Complaint Validation
- ID Format: `CLN-XXXXXX` (regex validated)
- Sequential generation with zero-padding
- Persistent storage (in-memory, extendable to DB)

## Technical Specifications

**Global Command Processing Order:**
1. Exit/Cancel commands (highest priority)
2. Language change intent
3. File complaint intent
4. Track complaint intent
5. State-based flow (if no global match)

**Supported Input Types:**
- Text messages
- Images (via Twilio MediaUrl)
- GPS coordinates (Latitude/Longitude)
- Voice notes (MediaUrl with audio MIME)

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
