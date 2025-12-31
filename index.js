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
  MENU: 'MENU',
  FILE_COMPLAINT_LOCATION: 'FILE_COMPLAINT_LOCATION',
  TRACK_COMPLAINT: 'TRACK_COMPLAINT'
};

// Multi-language messages
const messages = {
  tamil: {
    welcome: '🙏 க்ளீன்நாடு வாட்ஸ்அப் போட்டில் வரவேற்கிறோம்!\n\nஉங்கள் விருப்ப மொழியைத் தேர்ந்தெடுக்கவும்:\n1️⃣ தமிழ்\n2️⃣ English\n3️⃣ हिंदी',
    menu: '📋 தயவுசெய்து ஒரு விருப்பத்தை தேர்ந்தெடுக்கவும்:\n\n1️⃣ புகார் பதிவு செய்ய\n2️⃣ புகாரை கண்காணிக்க',
    fileComplaint: '📸 சுத்தமில்லாத இடத்தின் படத்தை அனுப்பவும்.\n\nஅல்லது பின்வருவனவற்றை அனுப்பலாம்:\n• 📍 நேரடி இருப்பிடம்\n• 📝 முகவரி (உரை)\n• 🎤 குரல் குறிப்பு\n• 🖼️ முகவரியுடன் படம்',
    trackComplaint: '🔍 உங்கள் புகார் எண்ணை உள்ளிடவும் (எ.கா: CLN-000001)',
    complaintRegistered: '✅ உங்கள் புகார் பதிவு செய்யப்பட்டது!\n\n🆔 புகார் எண்: {id}\n📊 நிலை: நிலுவையில்\n\nஇந்த எண்ணைப் பயன்படுத்தி உங்கள் புகாரைக் கண்காணிக்கலாம்.',
    complaintNotFound: '❌ புகார் கிடைக்கவில்லை. தயவுசெய்து எண்ணை சரிபார்க்கவும்.',
    complaintStatus: '📋 புகார் விவரங்கள்:\n\n🆔 எண்: {id}\n📊 நிலை: {status}\n📅 தேதி: {date}',
    invalidOption: '❌ தவறான விருப்பம். தயவுசெய்து மீண்டும் முயற்சிக்கவும்.'
  },
  english: {
    welcome: '🙏 Welcome to Cleannadu WhatsApp Bot!\n\nPlease select your preferred language:\n1️⃣ தமிழ்\n2️⃣ English\n3️⃣ हिंदी',
    menu: '📋 Please select an option:\n\n1️⃣ File a complaint\n2️⃣ Track complaint',
    fileComplaint: '📸 Please send an image of the unclean location.\n\nAlternatively, you can send:\n• 📍 Live location\n• 📝 Address (text)\n• 🎤 Voice note\n• 🖼️ Image with address',
    trackComplaint: '🔍 Please enter your complaint ID (e.g., CLN-000001)',
    complaintRegistered: '✅ Your complaint has been registered!\n\n🆔 Complaint ID: {id}\n📊 Status: Pending\n\nUse this ID to track your complaint.',
    complaintNotFound: '❌ Complaint not found. Please check the ID.',
    complaintStatus: '📋 Complaint Details:\n\n🆔 ID: {id}\n📊 Status: {status}\n📅 Date: {date}',
    invalidOption: '❌ Invalid option. Please try again.'
  },
  hindi: {
    welcome: '🙏 क्लीननाडु व्हाट्सएप बॉट में आपका स्वागत है!\n\nकृपया अपनी पसंदीदा भाषा चुनें:\n1️⃣ தமிழ்\n2️⃣ English\n3️⃣ हिंदी',
    menu: '📋 कृपया एक विकल्प चुनें:\n\n1️⃣ शिकायत दर्ज करें\n2️⃣ शिकायत ट्रैक करें',
    fileComplaint: '📸 कृपया गंदे स्थान की छवि भेजें।\n\nवैकल्पिक रूप से, आप भेज सकते हैं:\n• 📍 लाइव लोकेशन\n• 📝 पता (टेक्स्ट)\n• 🎤 वॉयस नोट\n• 🖼️ पते के साथ छवि',
    trackComplaint: '🔍 कृपया अपनी शिकायत आईडी दर्ज करें (उदा: CLN-000001)',
    complaintRegistered: '✅ आपकी शिकायत दर्ज कर ली गई है!\n\n🆔 शिकायत आईडी: {id}\n📊 स्थिति: लंबित\n\nअपनी शिकायत को ट्रैक करने के लिए इस आईडी का उपयोग करें।',
    complaintNotFound: '❌ शिकायत नहीं मिली। कृपया आईडी जांचें।',
    complaintStatus: '📋 शिकायत विवरण:\n\n🆔 आईडी: {id}\n📊 स्थिति: {status}\n📅 तारीख: {date}',
    invalidOption: '❌ अमान्य विकल्प। कृपया पुनः प्रयास करें।'
  }
};

// Helper function to get or create user session
function getSession(userId) {
  if (!userSessions[userId]) {
    userSessions[userId] = {
      state: STATES.START,
      language: null,
      data: {}
    };
  }
  return userSessions[userId];
}

// Helper function to generate complaint ID
function generateComplaintId() {
  const id = `CLN-${String(complaintCounter).padStart(6, '0')}`;
  complaintCounter++;
  return id;
}

// Helper function to get message in user's language
function getMessage(session, key, replacements = {}) {
  const lang = session.language || 'english';
  let message = messages[lang][key] || messages.english[key];
  
  Object.keys(replacements).forEach(key => {
    message = message.replace(`{${key}}`, replacements[key]);
  });
  
  return message;
}

app.get('/', (req, res) => {
  res.send('Twilio WhatsApp Bot is running');
});

app.post('/whatsapp', (req, res) => {
  const from = req.body.From;
  const messageBody = (req.body.Body || '').trim();
  const numMedia = parseInt(req.body.NumMedia) || 0;
  const mediaUrl = numMedia > 0 ? req.body.MediaUrl0 : null;
  const latitude = req.body.Latitude;
  const longitude = req.body.Longitude;
  
  console.log(`📩 Message from ${from}: "${messageBody}", Media: ${numMedia}, Location: ${latitude ? 'Yes' : 'No'}`);
  
  const session = getSession(from);
  const twiml = new twilio.twiml.MessagingResponse();
  let replyMessage = '';

  try {
    switch (session.state) {
      case STATES.START:
        // Welcome message - ask for language
        replyMessage = messages.english.welcome;
        session.state = STATES.LANGUAGE_SELECT;
        break;

      case STATES.LANGUAGE_SELECT:
        // Handle language selection
        if (messageBody === '1') {
          session.language = 'tamil';
          replyMessage = getMessage(session, 'menu');
          session.state = STATES.MENU;
        } else if (messageBody === '2') {
          session.language = 'english';
          replyMessage = getMessage(session, 'menu');
          session.state = STATES.MENU;
        } else if (messageBody === '3') {
          session.language = 'hindi';
          replyMessage = getMessage(session, 'menu');
          session.state = STATES.MENU;
        } else {
          replyMessage = getMessage(session, 'invalidOption') + '\n\n' + messages.english.welcome;
        }
        break;

      case STATES.MENU:
        // Handle menu selection
        if (messageBody === '1') {
          replyMessage = getMessage(session, 'fileComplaint');
          session.state = STATES.FILE_COMPLAINT_LOCATION;
        } else if (messageBody === '2') {
          replyMessage = getMessage(session, 'trackComplaint');
          session.state = STATES.TRACK_COMPLAINT;
        } else {
          replyMessage = getMessage(session, 'invalidOption') + '\n\n' + getMessage(session, 'menu');
        }
        break;

      case STATES.FILE_COMPLAINT_LOCATION:
        // Handle location/image/address submission
        let locationInfo = '';
        
        if (latitude && longitude) {
          locationInfo = `Location: ${latitude}, ${longitude}`;
        } else if (mediaUrl) {
          locationInfo = `Media: ${mediaUrl}`;
        } else if (messageBody) {
          locationInfo = `Address: ${messageBody}`;
        }
        
        if (locationInfo) {
          const complaintId = generateComplaintId();
          const complaint = {
            id: complaintId,
            userId: from,
            location: locationInfo,
            status: 'Pending',
            date: new Date().toISOString()
          };
          complaints.push(complaint);
          
          console.log(`✅ Complaint registered: ${complaintId}`);
          
          replyMessage = getMessage(session, 'complaintRegistered', { id: complaintId });
          
          // Reset to menu
          session.state = STATES.MENU;
          replyMessage += '\n\n' + getMessage(session, 'menu');
        } else {
          replyMessage = getMessage(session, 'fileComplaint');
        }
        break;

      case STATES.TRACK_COMPLAINT:
        // Handle complaint tracking
        const complaintId = messageBody.toUpperCase();
        const complaint = complaints.find(c => c.id === complaintId);
        
        if (complaint) {
          const date = new Date(complaint.date).toLocaleString();
          replyMessage = getMessage(session, 'complaintStatus', {
            id: complaint.id,
            status: complaint.status,
            date: date
          });
        } else {
          replyMessage = getMessage(session, 'complaintNotFound');
        }
        
        // Back to menu
        session.state = STATES.MENU;
        replyMessage += '\n\n' + getMessage(session, 'menu');
        break;

      default:
        session.state = STATES.START;
        replyMessage = messages.english.welcome;
    }

    twiml.message(replyMessage);
    console.log(`📤 Reply: "${replyMessage.substring(0, 50)}..."`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    twiml.message('Sorry, an error occurred. Please try again.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

app.listen(PORT, () => {
  console.log(`🚀 Twilio WhatsApp Bot server is running on port ${PORT}`);
  console.log(`📊 Complaint counter starts at: ${complaintCounter}`);
});
