# Cleannadu WhatsApp Bot

A production-ready Twilio WhatsApp Bot backend built with Node.js and Express.

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

- `hi` or `hello` - Receive a welcome message
- `help` - Display available commands
- Any other message - Bot echoes your message back

## API Endpoints

- `GET /` - Health check endpoint
- `POST /whatsapp` - WhatsApp webhook endpoint (configured in Twilio)
