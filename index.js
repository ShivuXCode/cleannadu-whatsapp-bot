require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Twilio WhatsApp Bot is running');
});

app.post('/whatsapp', (req, res) => {
  const incomingMessage = (req.body.Body || '').trim().toLowerCase();

  const from = req.body.From;
  
  // Log incoming message
  console.log(`📩 Incoming message from ${from}: "${req.body.Body}"`);
  
  const twiml = new twilio.twiml.MessagingResponse();
  let replyMessage = '';

  if (incomingMessage === 'hi' || incomingMessage === 'hello') {
    replyMessage = 'Welcome to Cleannadu WhatsApp Bot! 👋\n\nI\'m here to help you. Type "help" to see available commands.';
  } else if (incomingMessage === 'help') {
    replyMessage = '📋 Available Commands:\n\n' +
                   '• hi/hello - Get a welcome message\n' +
                   '• help - Show this help menu\n' +
                   '• Any other message - I\'ll echo it back to you\n\n' +
                   'Have a great day!';
  } else {
    replyMessage = `You said: "${req.body.Body}"`;
  }

  twiml.message(replyMessage);
  
  console.log(`📤 Sending reply: "${replyMessage}"`);
  
  res.type('text/xml');
  res.send(twiml.toString());
});

app.listen(PORT, () => {
  console.log(`🚀 Twilio WhatsApp Bot server is running on port ${PORT}`);
});
