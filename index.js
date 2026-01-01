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

// Language aliases for direct matching (no confirmation needed)
const LANGUAGE_ALIASES = {
  en: [
    'english', 'eng', 'en', 'engl', 'englsh', 'englis', 'englidh', 
    'inglish', 'inglesh', 'enkish', 'anglish'
  ],
  ta: [
    'tamil', 'தமிழ்', 'தமிழ', 'tamizh', 'taml', 'thamil', 'tamill'
  ],
  hi: [
    'hindi', 'हिंदी', 'हिन्दी', 'indi', 'hindhi', 'hind'
  ]
};

// Detect language from text input with priority order
function detectLanguageFromText(text) {
  const normalized = normalize(text);
  
  // Priority 1: Check exact/alias matches (case-insensitive, direct selection)
  for (const [langCode, aliases] of Object.entries(LANGUAGE_ALIASES)) {
    if (aliases.some(alias => normalized === alias || normalized.includes(alias))) {
      return { lang: langCode, needsConfirmation: false };
    }
  }
  
  // Priority 2: Fuzzy regex matching for Tamil/Hindi only (needs confirmation)
  // Tamil fuzzy patterns
  if (/tam|தமி/.test(normalized)) {
    return { lang: 'ta', needsConfirmation: true };
  }
  
  // Hindi fuzzy patterns
  if (/hin|हिं/.test(normalized)) {
    return { lang: 'hi', needsConfirmation: true };
  }
  
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
  const from = req.body.From;
  const body = req.body.Body || '';
  const session = getSession(from);
  const lang = session.language;

  // ====================== STATE MACHINE ======================

  // STATE: LANGUAGE_SELECTION - Handle FIRST with priority order
  if (session.state === 'LANGUAGE_SELECTION') {
    const normalized = normalize(body);
    
    // Priority 1: Numeric input (1, 2, 3)
    if (body === '1') {
      session.language = 'ta';
      session.state = 'MAIN_MENU';
      return reply(res, messages.ta.mainMenu);
    }
    if (body === '2') {
      session.language = 'en';
      session.state = 'MAIN_MENU';
      return reply(res, messages.en.mainMenu);
    }
    if (body === '3') {
      session.language = 'hi';
      session.state = 'MAIN_MENU';
      return reply(res, messages.hi.mainMenu);
    }
    
    // Priority 2: Text-based language detection
    const langDetection = detectLanguageFromText(body);
    if (langDetection) {
      if (!langDetection.needsConfirmation) {
        // Direct selection (English or exact match for Tamil/Hindi)
        session.language = langDetection.lang;
        session.state = 'MAIN_MENU';
        return reply(res, messages[langDetection.lang].mainMenu);
      } else {
        // Fuzzy match - ask for confirmation (Tamil/Hindi only)
        session.pendingLanguage = langDetection.lang;
        session.previousState = 'LANGUAGE_SELECTION';
        session.state = 'LANGUAGE_CONFIRMATION';
        const langName = langDetection.lang === 'ta' ? 'தமிழ்' : 'हिंदी';
        return reply(res, `Did you mean ${langName}?\n\nReply YES or NO`);
      }
    }
    
    // Invalid selection - show language menu again
    return reply(res, messages.en.chooseLanguage);
  }

  // STATE: LANGUAGE_CONFIRMATION - Handle YES/NO responses
  if (session.state === 'LANGUAGE_CONFIRMATION') {
    const normalized = normalize(body);
    if (normalized === 'yes' || normalized === 'y') {
      session.language = session.pendingLanguage;
      session.state = session.previousState === 'LANGUAGE_SELECTION' ? 'MAIN_MENU' : session.previousState;
      session.pendingLanguage = null;
      session.previousState = null;
      return reply(res, messages[session.language].mainMenu);
    } else {
      // User said no, revert to previous state
      const prevState = session.previousState || 'MAIN_MENU';
      session.state = prevState;
      session.pendingLanguage = null;
      session.previousState = null;
      
      if (prevState === 'LANGUAGE_SELECTION') {
        return reply(res, messages.en.chooseLanguage);
      } else {
        return reply(res, messages[lang].mainMenu);
      }
    }
  }

  // ---------- GLOBAL LANGUAGE SWITCHING (works anytime after initial selection) ----------
  const langDetection = detectLanguageFromText(body);
  if (langDetection && session.language !== langDetection.lang) {
    if (!langDetection.needsConfirmation) {
      // Direct language switch (English or exact match)
      session.language = langDetection.lang;
      session.state = 'MAIN_MENU';
      return reply(res, messages[langDetection.lang].mainMenu);
    } else {
      // Fuzzy match - ask for confirmation
      session.pendingLanguage = langDetection.lang;
      session.previousState = session.state;
      session.state = 'LANGUAGE_CONFIRMATION';
      const langName = langDetection.lang === 'ta' ? 'தமிழ்' : 'हिंदी';
      return reply(res, `Did you mean ${langName}?\n\nReply YES or NO`);
    }
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

  // Fallback - unknown state
  return reply(res, messages[lang].mainMenu);
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
