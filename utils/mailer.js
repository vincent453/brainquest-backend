// utils/mailer.js - MAILERSEND VERSION FOR RENDER.COM
const nodemailer = require("nodemailer");

// Validate environment variables
if (!process.env.MAILERSEND_API_KEY) {
  console.error('❌ ERROR: MAILERSEND_API_KEY is not set in environment variables');
  console.error('📝 To fix: Add MAILERSEND_API_KEY to your Render.com environment variables');
  console.error('📖 Get API key from: https://www.mailersend.com/');
  throw new Error('MAILERSEND_API_KEY environment variable is required');
}

console.log('📧 Initializing MailerSend transporter...');
console.log('   API Token:', process.env.MAILERSEND_API_KEY ? '✅ Set (hidden)' : '❌ Not set');

// MailerSend SMTP Configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.mailersend.net',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: 'MS_XXXXXX', // This will be overridden, but required by nodemailer
    pass: process.env.MAILERSEND_API_KEY, // Your MailerSend API token
  },
  // Connection settings
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
  // MailerSend specific
  tls: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  }
});

// Verify transporter configuration on startup
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ MailerSend transporter verification FAILED:', error.message);
    console.error('');
    console.error('🔍 Common fixes:');
    console.error('   1. Make sure MAILERSEND_API_KEY is set in Render environment variables');
    console.error('   2. Make sure the API token is valid (starts with mlsn_)');
    console.error('   3. Check domain is verified in MailerSend dashboard');
    console.error('   4. Check sender email is verified in MailerSend');
    console.error('');
  } else {
    console.log('✅ MailerSend transporter is ready to send emails');
  }
});

module.exports = transporter;