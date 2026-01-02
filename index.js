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
  // Log incoming request for debugging
  console.log("📩 Incoming:", JSON.stringify(req.body, null, 2));
  
  try {
    const from = req.body.From;
    const body = req.body.Body || '';
    const session = getSession(from);
    const lang = session.language;

  // ================= LANGUAGE HANDLING (SAFE) =================
  const input = normalize(body);

  // Numeric language selection
  if (session.state === 'LANGUAGE_SELECTION') {
    if (input === '1') {
      session.language = 'ta';
      session.state = 'MAIN_MENU';
      return reply(res, messages.ta.mainMenu);
    }
    if (input === '2') {
      session.language = 'en';
      session.state = 'MAIN_MENU';
      return reply(res, messages.en.mainMenu);
    }
    if (input === '3') {
      session.language = 'hi';
      session.state = 'MAIN_MENU';
      return reply(res, messages.hi.mainMenu);
    }
  }

  // Direct English text selection (NO confirmation)
  if (
    input === 'english' ||
    input === 'eng' ||
    input === 'en' ||
    input === 'englsh' ||
    input === 'inglish'
  ) {
    session.language = 'en';
    session.state = 'MAIN_MENU';
    return reply(res, messages.en.mainMenu);
  }

  // Tamil fuzzy (confirmation required)
  if (/tam|தமிழ/.test(input)) {
    session.pendingLanguage = 'ta';
    session.previousState = session.state;
    session.state = 'LANGUAGE_CONFIRMATION';
    return reply(res, 'Did you mean தமிழ்?\n\nReply YES or NO');
  }

  // Hindi fuzzy (confirmation required)
  if (/hin|हिं/.test(input)) {
    session.pendingLanguage = 'hi';
    session.previousState = session.state;
    session.state = 'LANGUAGE_CONFIRMATION';
    return reply(res, 'Did you mean हिंदी?\n\nReply YES or NO');
  }

  // YES confirmation
  if (input === 'yes' && session.pendingLanguage) {
    session.language = session.pendingLanguage;
    session.pendingLanguage = null;
    session.state = 'MAIN_MENU';
    return reply(res, messages[session.language].mainMenu);
  }

  // NO confirmation
  if (input === 'no' && session.pendingLanguage) {
    session.pendingLanguage = null;
    session.previousState = null;
    session.state = 'LANGUAGE_SELECTION';
    return reply(res, messages.en.chooseLanguage);
  }

  // ---------- GLOBAL COMMAND SHORTCUTS ----------
  const globalIntent = detectGlobalIntent(body);
  
  if (globalIntent === 'EXIT') {
    session.state = 'LANGUAGE_SELECTION';
    session.complaintData = {};
    return reply(res, messages[lang].thankYou);
  }
  
  if (globalIntent === 'MENU') {
    session.state = 'LANGUAGE_SELECTION';
    session.complaintData = {};
    return reply(res, messages.en.chooseLanguage);
  }
  
  if (globalIntent === 'TRACK') {
    session.state = 'WAITING_TRACKING_ID';
    return reply(res, messages[lang].askTrackingId);
  }
  
  if (globalIntent === 'REPORT') {
    session.state = 'WAITING_PHOTO';
    session.complaintData = {};
    return reply(res, messages[lang].reportPhoto);
  }

  // ====================== STATE MACHINE ======================

  // STATE: MAIN_MENU
  if (session.state === 'MAIN_MENU') {
    if (body === '1') {
      session.state = 'WAITING_PHOTO';
      session.complaintData = {};
      return reply(res, messages[lang].reportPhoto);
    }
    if (body === '2') {
      session.state = 'WAITING_TRACKING_ID';
      return reply(res, messages[lang].askTrackingId);
    }
    // Invalid option
    return reply(res, messages[lang].mainMenu);
  }

  // STATE: WAITING_PHOTO
  if (session.state === 'WAITING_PHOTO') {
    const numMedia = Number(req.body.NumMedia) || 0;
    
    if (numMedia > 0) {
      // Photo received
      session.complaintData.photoUrl = req.body.MediaUrl0;
      session.complaintData.issueType = 'Garbage';
      session.state = 'WAITING_LOCATION_DECISION';
      return reply(res, messages[lang].askLocationChoice);
    }
    
    // No photo, ask again
    return reply(res, messages[lang].photoOnly);
  }

  // STATE: WAITING_LOCATION_DECISION
  if (session.state === 'WAITING_LOCATION_DECISION') {
    if (body === '1') {
      // User wants to send GPS location
      session.state = 'WAITING_GPS_LOCATION';
      return reply(res, messages[lang].askSendLocation);
    }
    if (body === '2') {
      // User wants to type address
      session.state = 'WAITING_ADDRESS_TEXT';
      return reply(res, messages[lang].askTypeAddress);
    }
    // Invalid choice
    return reply(res, messages[lang].askLocationChoice);
  }

  // STATE: WAITING_GPS_LOCATION
  if (session.state === 'WAITING_GPS_LOCATION') {
    if (req.body.Latitude && req.body.Longitude) {
      session.complaintData.location = `GPS: ${req.body.Latitude}, ${req.body.Longitude}`;
    } else if (body) {
      // Fallback to text if they didn't send GPS
      session.complaintData.location = `Address: ${body}`;
    } else {
      return reply(res, messages[lang].askSendLocation);
    }

    // Register complaint
    const trackingId = generateTrackingId();
    complaintsDB[trackingId] = {
      trackingId,
      issueType: session.complaintData.issueType,
      location: session.complaintData.location,
      photoUrl: session.complaintData.photoUrl,
      status: 'In Progress',
      createdAt: new Date().toISOString()
    };

    session.state = 'MAIN_MENU';
    session.complaintData = {};
    return reply(
      res,
      messages[lang].complaintRegistered.replace('{trackingId}', trackingId)
    );
  }

  // STATE: WAITING_ADDRESS_TEXT
  if (session.state === 'WAITING_ADDRESS_TEXT') {
    if (!body.trim()) {
      return reply(res, messages[lang].askTypeAddress);
    }

    session.complaintData.location = `Address: ${body}`;

    // Register complaint
    const trackingId = generateTrackingId();
    complaintsDB[trackingId] = {
      trackingId,
      issueType: session.complaintData.issueType,
      location: session.complaintData.location,
      photoUrl: session.complaintData.photoUrl,
      status: 'In Progress',
      createdAt: new Date().toISOString()
    };

    session.state = 'MAIN_MENU';
    session.complaintData = {};
    return reply(
      res,
      messages[lang].complaintRegistered.replace('{trackingId}', trackingId)
    );
  }

  // STATE: WAITING_TRACKING_ID
  if (session.state === 'WAITING_TRACKING_ID') {
    const id = body.toUpperCase().trim();
    
    if (!complaintsDB[id]) {
      return reply(res, messages[lang].complaintNotFound);
    }

    const complaint = complaintsDB[id];
    session.state = 'MAIN_MENU';
    
    return reply(
      res,
      `📋 *Status of ${id}*\n\n` +
      `📊 Status: ${complaint.status}\n` +
      `📍 Location: ${complaint.location}\n` +
      `📅 Submitted: ${new Date(complaint.createdAt).toLocaleString()}\n\n` +
      messages[lang].mainMenu
    );
  }

  // Absolute fallback (prevents silent failure)
  return reply(res, messages[lang].mainMenu);
  
  } catch (error) {
    // Critical error handler - ALWAYS send TwiML
    console.error("❌ Error in webhook:", error);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("⚠️ Bot encountered an error. Please type 'menu' to restart.");
    return res.type('text/xml').send(twiml.toString());
  }
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
