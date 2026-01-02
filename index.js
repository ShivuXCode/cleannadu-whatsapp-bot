require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const messages = require('./messages');

// ====================== IN-MEMORY STORES ======================
const userSessions = {};
const complaintsDB = {};
let trackingCounter = 100000;

// ====================== HELPERS ======================
function getSession(userId) {
  if (!userSessions[userId]) {
    userSessions[userId] = {
      state: 'LANGUAGE_SELECTION',
      language: 'en',
      complaintData: {},
      pendingLanguage: null
    };
  }
  return userSessions[userId];
}

function generateTrackingId() {
  trackingCounter++;
  return `CN-${trackingCounter}`;
}

function normalize(text = '') {
  return text.toLowerCase().trim();
}

// Enhanced fuzzy language detection with typo tolerance
function detectLanguage(text) {
  const t = normalize(text);
  
  // Tamil detection - handle common typos
  if (/tam[il]*|தமிழ்?|tamill|thamil/.test(t)) return 'ta';
  
  // Hindi detection - handle common typos
  if (/hin[di]*|हिं[दी]*|hindhi|indi/.test(t)) return 'hi';
  
  // English detection - handle common typos
  if (/eng[lish]*|englidh|inglish/.test(t)) return 'en';
  
  return null;
}

// Global intent detection - works in ANY state
function detectGlobalIntent(text) {
  const t = normalize(text);
  
  // Exit commands
  if (/^(exit|cancel|quit|stop)$/i.test(t)) return 'EXIT';
  
  // Menu commands - restart to language selection
  if (/(main\s*)?menu|home/.test(t)) return 'MENU';
  
  // Track commands (multilingual)
  if (/track|status|check|நிலை|स्थिति/.test(t)) return 'TRACK';
  
  // File complaint commands (multilingual)
  if (/file|complaint|report|புகார்|शिकायत/.test(t)) return 'REPORT';
  
  return null;
}

function reply(res, text) {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(text);
  res.type('text/xml').send(twiml.toString());
}

// ====================== MAIN WEBHOOK ======================
app.post('/whatsapp', (req, res) => {
  console.log('🔥 Webhook hit');

  res.status(200)
     .set('Content-Type', 'text/xml')
     .send(`
       <Response>
         <Message>✅ Twilio webhook is responding</Message>
       </Response>
     `);
});

// ====================== HEALTH CHECK ======================
app.get('/', (_, res) => {
  res.json({ 
    status: 'CleanNadu Twilio Bot Running',
    complaints: Object.keys(complaintsDB).length,
    activeSessions: Object.keys(userSessions).length
  });
});

// ====================== SERVER START ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CleanNadu Bot running on port ${PORT}`);
  console.log(`📍 Webhook: POST /whatsapp`);
  console.log(`🏥 Health: GET /`);
});
