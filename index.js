require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// In-memory storage for user sessions and complaints
const userSessions = {};
const complaints = [];
let complaintCounter = 1;

// Conversation states
const STATES = {
  START: 'START',
  LANGUAGE_SELECT: 'LANGUAGE_SELECT',
  LANGUAGE_CONFIRM: 'LANGUAGE_CONFIRM',
  MENU: 'MENU',
  FILE_COMPLAINT_LOCATION: 'FILE_COMPLAINT_LOCATION',
  TRACK_COMPLAINT: 'TRACK_COMPLAINT'
};

// Multi-language messages
const messages = {
  tamil: {
    welcome: '🙏 க்ளீன்நாடு வாட்ஸ்அப் போட்டில் வரவேற்கிறோம்!\n\nஉங்கள் விருப்ப மொழியைத் தேர்ந்தெடுக்கவும்:',
    menu: '📋 தயவுசெய்து ஒரு விருப்பத்தை தேர்ந்தெடுக்கவும்:\n\n1️⃣ புகார் பதிவு செய்ய\n2️⃣ புகாரை கண்காணிக்க\n3️⃣ வெளியேறு',
    fileComplaint: '📸 சுத்தமில்லாத இடத்தின் படத்தை அனுப்பவும்.\n\nஅல்லது பின்வருவனவற்றை அனுப்பலாம்:\n• 📍 நேரடி இருப்பிடம்\n• 📝 முகவரி (உரை)\n• 🎤 குரல் குறிப்பு\n• 🖼️ முகவரியுடன் படம்',
    trackComplaint: '🔍 உங்கள் புகார் எண்ணை உள்ளிடவும் (எ.கா: CLN-000001)',
    complaintRegistered: '✅ உங்கள் புகார் பதிவு செய்யப்பட்டது!\n\n🆔 புகார் எண்: {id}\n📊 நிலை: நிலுவையில்\n\nஇந்த எண்ணைப் பயன்படுத்தி உங்கள் புகாரைக் கண்காணிக்கலாம்.',
    complaintNotFound: '❌ புகார் கிடைக்கவில்லை. தயவுசெய்து எண்ணை சரிபார்க்கவும்.',
    complaintStatus: '📋 புகார் விவரங்கள்:\n\n🆔 எண்: {id}\n📊 நிலை: {status}\n📅 தேதி: {date}',
    invalidOption: '❌ தவறான விருப்பம். தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
    invalidComplaintId: '❌ தவறான புகார் எண் வடிவம். CLN-XXXXXX வடிவத்தில் இருக்க வேண்டும்.',
    languageConfirm: 'தமிழ் என்று சொல்ல வேண்டுமா?\n\nYES அல்லது NO என்று பதிலளிக்கவும்.',
    languageChanged: '✅ மொழி தமிழுக்கு மாற்றப்பட்டது',
    languageSelector: '🌐 மொழி: 1️⃣ தமிழ் | 2️⃣ English | 3️⃣ हिंदी'
  },
  english: {
    welcome: '🙏 Welcome to CleanNadu WhatsApp Bot!\n\nPlease select your preferred language:',
    menu: '📋 Please select an option:\n\n1️⃣ File a cleanliness complaint\n2️⃣ Track complaint status\n3️⃣ Exit',
    fileComplaint: '📸 Please send an image of the unclean location.\n\nAlternatively, you can send:\n• 📍 Live location\n• 📝 Address (text)\n• 🎤 Voice note\n• 🖼️ Image with address',
    trackComplaint: '🔍 Please enter your complaint ID (e.g., CLN-000001)',
    complaintRegistered: '✅ Your complaint has been registered!\n\n🆔 Complaint ID: {id}\n📊 Status: Pending\n\nUse this ID to track your complaint.',
    complaintNotFound: '❌ Complaint not found. Please check the ID.',
    complaintStatus: '📋 Complaint Details:\n\n🆔 ID: {id}\n📊 Status: {status}\n📅 Date: {date}',
    invalidOption: '❌ Invalid option. Please try again.',
    invalidComplaintId: '❌ Invalid complaint ID format. Should be CLN-XXXXXX.',
    languageConfirm: 'Did you mean English?\n\nReply YES or NO.',
    languageChanged: '✅ Language changed to English',
    languageSelector: '🌐 Language: 1️⃣ தமிழ் | 2️⃣ English | 3️⃣ हिंदी'
  },
  hindi: {
    welcome: '🙏 क्लीननाडु व्हाट्सएप बॉट में आपका स्वागत है!\n\nकृपया अपनी पसंदीदा भाषा चुनें:',
    menu: '📋 कृपया एक विकल्प चुनें:\n\n1️⃣ शिकायत दर्ज करें\n2️⃣ शिकायत की स्थिति ट्रैक करें\n3️⃣ बाहर निकलें',
    fileComplaint: '📸 कृपया गंदे स्थान की छवि भेजें।\n\nवैकल्पिक रूप से, आप भेज सकते हैं:\n• 📍 लाइव लोकेशन\n• 📝 पता (टेक्स्ट)\n• 🎤 वॉयस नोट\n• 🖼️ पते के साथ छवि',
    trackComplaint: '🔍 कृपया अपनी शिकायत आईडी दर्ज करें (उदा: CLN-000001)',
    complaintRegistered: '✅ आपकी शिकायत दर्ज कर ली गई है!\n\n🆔 शिकायत आईडी: {id}\n📊 स्थिति: लंबित\n\nअपनी शिकायत को ट्रैक करने के लिए इस आईडी का उपयोग करें।',
    complaintNotFound: '❌ शिकायत नहीं मिली। कृपया आईडी जांचें।',
    complaintStatus: '📋 शिकायत विवरण:\n\n🆔 आईडी: {id}\n📊 स्थिति: {status}\n📅 तारीख: {date}',
    invalidOption: '❌ अमान्य विकल्प। कृपया पुनः प्रयास करें।',
    invalidComplaintId: '❌ अमान्य शिकायत आईडी प्रारूप। CLN-XXXXXX होना चाहिए।',
    languageConfirm: 'क्या आपका मतलब हिंदी था?\n\nYES या NO में उत्तर दें।',
    languageChanged: '✅ भाषा हिंदी में बदल दी गई',
    languageSelector: '🌐 भाषा: 1️⃣ தமிழ் | 2️⃣ English | 3️⃣ हिंदी'
  }
};

// Language patterns for fuzzy matching
const languagePatterns = {
  tamil: ['tamil', 'tamizh', 'tamiz', 'thamil', 'thamizh', 'taml', 'தமிழ்', '1'],
  english: ['english', 'eng', 'engl', 'englsh', 'englidh', 'inglish', '2'],
  hindi: ['hindi', 'indi', 'hind', 'hindie', 'हिंदी', '3']
};

// Global command patterns
const commandPatterns = {
  file: ['file', 'register', 'complaint', 'new', 'புகார்', 'शिकायत', 'pukaar'],
  track: ['track', 'status', 'check', 'கண்காணி', 'ट्रैक', 'kankaani'],
  exit: ['exit', 'quit', 'cancel', 'stop', 'வெளியேறு', 'बाहर', 'veliyeru']
};

// ============ HELPER FUNCTIONS ============

// Fuzzy matching for intent detection
function fuzzyMatch(input, patterns) {
  const normalized = input.toLowerCase().trim();
  return patterns.some(pattern => {
    return normalized.includes(pattern) || pattern.includes(normalized) || 
           levenshteinDistance(normalized, pattern) <= 2;
  });
}

// Simple Levenshtein distance for typo tolerance
function levenshteinDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Detect language intent
function detectLanguageIntent(input) {
  for (const [lang, patterns] of Object.entries(languagePatterns)) {
    if (fuzzyMatch(input, patterns)) {
      return lang;
    }
  }
  return null;
}

// Detect global command intent
function detectGlobalCommand(input) {
  for (const [command, patterns] of Object.entries(commandPatterns)) {
    if (fuzzyMatch(input, patterns)) {
      return command;
    }
  }
  return null;
}

// Validate complaint ID format
function isValidComplaintId(id) {
  return /^CLN-\d{6}$/i.test(id);
}

// Get or create user session
function getSession(userId) {
  if (!userSessions[userId]) {
    userSessions[userId] = {
      state: STATES.START,
      language: null,
      data: {},
      pendingLanguage: null
    };
  }
  return userSessions[userId];
}

// Generate complaint ID
function generateComplaintId() {
  const id = `CLN-${String(complaintCounter).padStart(6, '0')}`;
  complaintCounter++;
  return id;
}

// Get message with replacements
function getMessage(session, key, replacements = {}) {
  const lang = session.language || 'english';
  let message = messages[lang][key] || messages.english[key];
  
  Object.keys(replacements).forEach(key => {
    message = message.replace(`{${key}}`, replacements[key]);
  });
  
  return message;
}

// Add language selector to message
function addLanguageSelector(session, message) {
  const selector = getMessage(session, 'languageSelector');
  return `${message}\n\n${selector}`;
}

// Reset conversation to menu
function resetToMenu(session) {
  session.state = STATES.MENU;
  session.data = {};
  return addLanguageSelector(session, getMessage(session, 'menu'));
}

// ============ MAIN WEBHOOK HANDLER ============

app.get('/', (req, res) => {
  res.send('CleanNadu WhatsApp Bot is running');
});

app.post('/whatsapp', (req, res) => {
  const from = req.body.From;
  const messageBody = (req.body.Body || '').trim();
  const numMedia = parseInt(req.body.NumMedia) || 0;
  const mediaUrl = numMedia > 0 ? req.body.MediaUrl0 : null;
  const latitude = req.body.Latitude;
  const longitude = req.body.Longitude;
  
  console.log(`📩 [${from}] Message: "${messageBody}", Media: ${numMedia}, Location: ${latitude ? 'Yes' : 'No'}`);
  
  const session = getSession(from);
  const twiml = new twilio.twiml.MessagingResponse();
  let replyMessage = '';

  try {
    // ============ GLOBAL COMMANDS - Process first ============
    
    // Check for exit/cancel command
    const exitIntent = detectGlobalCommand(messageBody);
    if (exitIntent === 'exit') {
      console.log(`🚪 [${from}] Exit command detected`);
      replyMessage = resetToMenu(session);
      twiml.message(replyMessage);
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }
    
    // Check for language change intent
    const languageIntent = detectLanguageIntent(messageBody);
    if (languageIntent && session.state !== STATES.LANGUAGE_SELECT && session.state !== STATES.LANGUAGE_CONFIRM) {
      console.log(`🌐 [${from}] Language intent detected: ${languageIntent}`);
      session.pendingLanguage = languageIntent;
      session.data.previousState = session.state;
      session.state = STATES.LANGUAGE_CONFIRM;
      
      // Temporarily set language to show confirmation in target language
      const oldLang = session.language;
      session.language = languageIntent;
      replyMessage = getMessage(session, 'languageConfirm');
      session.language = oldLang; // Restore until confirmed
      
      twiml.message(replyMessage);
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }
    
    // Check for file complaint intent
    if (detectGlobalCommand(messageBody) === 'file' && session.state !== STATES.FILE_COMPLAINT_LOCATION) {
      console.log(`📝 [${from}] File complaint intent detected`);
      session.state = STATES.FILE_COMPLAINT_LOCATION;
      replyMessage = addLanguageSelector(session, getMessage(session, 'fileComplaint'));
      twiml.message(replyMessage);
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }
    
    // Check for track complaint intent
    if (detectGlobalCommand(messageBody) === 'track' && session.state !== STATES.TRACK_COMPLAINT) {
      console.log(`🔍 [${from}] Track complaint intent detected`);
      session.state = STATES.TRACK_COMPLAINT;
      replyMessage = addLanguageSelector(session, getMessage(session, 'trackComplaint'));
      twiml.message(replyMessage);
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }

    // ============ STATE-BASED FLOW ============
    
    switch (session.state) {
      case STATES.START:
        console.log(`🎬 [${from}] Starting conversation`);
        replyMessage = messages.english.welcome + '\n\n1️⃣ தமிழ்\n2️⃣ English\n3️⃣ हिंदी';
        session.state = STATES.LANGUAGE_SELECT;
        break;

      case STATES.LANGUAGE_SELECT:
        const langChoice = messageBody;
        if (langChoice === '1' || fuzzyMatch(langChoice, languagePatterns.tamil)) {
          session.language = 'tamil';
          console.log(`🌐 [${from}] Language set: Tamil`);
          replyMessage = addLanguageSelector(session, getMessage(session, 'menu'));
          session.state = STATES.MENU;
        } else if (langChoice === '2' || fuzzyMatch(langChoice, languagePatterns.english)) {
          session.language = 'english';
          console.log(`🌐 [${from}] Language set: English`);
          replyMessage = addLanguageSelector(session, getMessage(session, 'menu'));
          session.state = STATES.MENU;
        } else if (langChoice === '3' || fuzzyMatch(langChoice, languagePatterns.hindi)) {
          session.language = 'hindi';
          console.log(`🌐 [${from}] Language set: Hindi`);
          replyMessage = addLanguageSelector(session, getMessage(session, 'menu'));
          session.state = STATES.MENU;
        } else {
          replyMessage = getMessage(session, 'invalidOption') + '\n\n' + 
                        messages.english.welcome + '\n\n1️⃣ தமிழ்\n2️⃣ English\n3️⃣ हिंदी';
        }
        break;

      case STATES.LANGUAGE_CONFIRM:
        const confirmation = messageBody.toLowerCase();
        if (confirmation === 'yes' || confirmation === 'y') {
          session.language = session.pendingLanguage;
          console.log(`✅ [${from}] Language changed to: ${session.language}`);
          replyMessage = getMessage(session, 'languageChanged') + '\n\n' + 
                        addLanguageSelector(session, getMessage(session, 'menu'));
          session.state = STATES.MENU;
          session.pendingLanguage = null;
        } else {
          // No language change, restore previous state
          session.state = session.data.previousState || STATES.MENU;
          session.pendingLanguage = null;
          
          if (session.state === STATES.MENU) {
            replyMessage = addLanguageSelector(session, getMessage(session, 'menu'));
          } else if (session.state === STATES.FILE_COMPLAINT_LOCATION) {
            replyMessage = addLanguageSelector(session, getMessage(session, 'fileComplaint'));
          } else if (session.state === STATES.TRACK_COMPLAINT) {
            replyMessage = addLanguageSelector(session, getMessage(session, 'trackComplaint'));
          } else {
            replyMessage = addLanguageSelector(session, getMessage(session, 'menu'));
            session.state = STATES.MENU;
          }
        }
        break;

      case STATES.MENU:
        if (messageBody === '1') {
          console.log(`📝 [${from}] Initiating complaint filing`);
          replyMessage = addLanguageSelector(session, getMessage(session, 'fileComplaint'));
          session.state = STATES.FILE_COMPLAINT_LOCATION;
        } else if (messageBody === '2') {
          console.log(`🔍 [${from}] Initiating complaint tracking`);
          replyMessage = addLanguageSelector(session, getMessage(session, 'trackComplaint'));
          session.state = STATES.TRACK_COMPLAINT;
        } else if (messageBody === '3') {
          console.log(`🚪 [${from}] Exit selected`);
          replyMessage = resetToMenu(session);
        } else {
          replyMessage = addLanguageSelector(session, 
            getMessage(session, 'invalidOption') + '\n\n' + getMessage(session, 'menu'));
        }
        break;

      case STATES.FILE_COMPLAINT_LOCATION:
        let locationInfo = '';
        
        if (latitude && longitude) {
          locationInfo = `GPS: ${latitude}, ${longitude}`;
          console.log(`📍 [${from}] Location received: ${locationInfo}`);
        } else if (mediaUrl) {
          locationInfo = `Media: ${mediaUrl}`;
          console.log(`📸 [${from}] Media received: ${mediaUrl}`);
        } else if (messageBody) {
          locationInfo = `Address: ${messageBody}`;
          console.log(`📝 [${from}] Text address received`);
        }
        
        if (locationInfo) {
          const complaintId = generateComplaintId();
          const complaint = {
            id: complaintId,
            userId: from,
            language: session.language,
            location: locationInfo,
            status: 'Pending',
            date: new Date().toISOString()
          };
          complaints.push(complaint);
          
          console.log(`✅ [${from}] Complaint registered: ${complaintId}`);
          
          replyMessage = getMessage(session, 'complaintRegistered', { id: complaintId }) + 
                        '\n\n' + addLanguageSelector(session, getMessage(session, 'menu'));
          session.state = STATES.MENU;
        } else {
          replyMessage = addLanguageSelector(session, getMessage(session, 'fileComplaint'));
        }
        break;

      case STATES.TRACK_COMPLAINT:
        const complaintId = messageBody.toUpperCase().trim();
        
        if (!isValidComplaintId(complaintId)) {
          console.log(`❌ [${from}] Invalid complaint ID format: ${complaintId}`);
          replyMessage = addLanguageSelector(session, 
            getMessage(session, 'invalidComplaintId') + '\n\n' + getMessage(session, 'trackComplaint'));
        } else {
          const complaint = complaints.find(c => c.id === complaintId);
          
          if (complaint) {
            const date = new Date(complaint.date).toLocaleString();
            console.log(`📋 [${from}] Complaint found: ${complaintId} - ${complaint.status}`);
            replyMessage = getMessage(session, 'complaintStatus', {
              id: complaint.id,
              status: complaint.status,
              date: date
            }) + '\n\n' + addLanguageSelector(session, getMessage(session, 'menu'));
          } else {
            console.log(`❌ [${from}] Complaint not found: ${complaintId}`);
            replyMessage = addLanguageSelector(session, 
              getMessage(session, 'complaintNotFound') + '\n\n' + getMessage(session, 'menu'));
          }
          
          session.state = STATES.MENU;
        }
        break;

      default:
        console.log(`⚠️ [${from}] Unknown state, resetting`);
        session.state = STATES.START;
        replyMessage = messages.english.welcome + '\n\n1️⃣ தமிழ்\n2️⃣ English\n3️⃣ हिंदी';
        session.state = STATES.LANGUAGE_SELECT;
    }

    twiml.message(replyMessage);
    console.log(`📤 [${from}] Reply sent (${replyMessage.length} chars)`);
    
  } catch (error) {
    console.error(`❌ [${from}] Error:`, error);
    twiml.message('Sorry, an error occurred. Please type "exit" to restart.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

app.listen(PORT, () => {
  console.log(`🚀 CleanNadu WhatsApp Bot server running on port ${PORT}`);
  console.log(`📊 Complaint counter starts at: CLN-${String(complaintCounter).padStart(6, '0')}`);
  console.log(`🌐 Supported languages: Tamil, English, Hindi`);
  console.log(`🤖 Global commands: Language change, File, Track, Exit (with fuzzy matching)`);
});
