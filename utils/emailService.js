// utils/emailService.js - MAILERSEND VERSION
const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");

// Validate API key
if (!process.env.MAILERSEND_API_KEY) {
  console.error('❌ ERROR: MAILERSEND_API_KEY not set in environment variables');
  console.error('   Add MAILERSEND_API_KEY to your Render environment');
  console.error('   Get it from: https://app.mailersend.com/');
  throw new Error('MAILERSEND_API_KEY is required');
}

// Initialize MailerSend
const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});

// Get configuration
const APP_NAME = process.env.APP_NAME || 'BrainQuest';
const APP_FROM_EMAIL = process.env.APP_FROM_EMAIL;
const APP_FROM_NAME = process.env.APP_FROM_NAME || APP_NAME;

if (!APP_FROM_EMAIL) {
  console.error('❌ ERROR: APP_FROM_EMAIL not set in environment variables');
  console.error('   Add APP_FROM_EMAIL to your Render environment');
  throw new Error('APP_FROM_EMAIL is required');
}

console.log(`✅ MailerSend configured`);
console.log(`   From: ${APP_FROM_NAME} <${APP_FROM_EMAIL}>`);

// ===============================
// Send verification email
// ===============================
exports.sendVerificationEmail = async (email, code, firstName) => {
  try {
    console.log(`📤 Sending verification email to: ${email}`);
    console.log(`   Code: ${code}`);

    const sentFrom = new Sender(APP_FROM_EMAIL, APP_FROM_NAME);
    const recipients = [new Recipient(email, firstName)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject('Email Verification Code - BrainQuest')
      .setHtml(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              color: #333; 
              margin: 0; 
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 32px;
              font-weight: 700;
              letter-spacing: -0.5px;
            }
            .content { 
              padding: 50px 40px;
              background: white;
            }
            .greeting {
              font-size: 20px;
              color: #1f2937;
              margin-bottom: 24px;
              font-weight: 600;
            }
            .message {
              font-size: 16px;
              color: #4b5563;
              line-height: 1.7;
              margin-bottom: 32px;
            }
            .code-container {
              background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
              border-radius: 12px;
              padding: 32px;
              text-align: center;
              margin: 32px 0;
              border: 3px dashed #4F46E5;
            }
            .code-label {
              font-size: 14px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 12px;
              font-weight: 600;
            }
            .code { 
              font-size: 42px; 
              font-weight: 800; 
              letter-spacing: 12px; 
              color: #4F46E5;
              font-family: 'Courier New', monospace;
              display: inline-block;
              padding: 16px 24px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .expiry {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 16px 20px;
              margin: 32px 0;
              border-radius: 6px;
            }
            .expiry-text {
              color: #92400e;
              font-size: 14px;
              margin: 0;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .security-note {
              background: #f0fdf4;
              border-left: 4px solid #22c55e;
              padding: 16px 20px;
              margin: 24px 0;
              border-radius: 6px;
            }
            .security-text {
              color: #166534;
              font-size: 14px;
              margin: 0;
            }
            .footer {
              padding: 30px 40px;
              background: #f9fafb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            .footer-brand {
              font-weight: 700;
              color: #4F46E5;
              font-size: 16px;
              margin-bottom: 8px;
            }
            .footer p {
              margin: 4px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🧠 BrainQuest</h1>
            </div>
            <div class="content">
              <p class="greeting">Hello ${firstName}! 👋</p>
              <p class="message">
                Welcome to BrainQuest! We're excited to have you on board. 
                To complete your registration and verify your email address, 
                please use the verification code below:
              </p>
              
              <div class="code-container">
                <div class="code-label">Your Verification Code</div>
                <div class="code">${code}</div>
              </div>
              
              <div class="expiry">
                <p class="expiry-text">
                  ⏰ <strong>Time Sensitive:</strong> This code will expire in 15 minutes for your security.
                </p>
              </div>
              
              <div class="security-note">
                <p class="security-text">
                  🔒 <strong>Security Tip:</strong> If you didn't create a BrainQuest account, 
                  you can safely ignore this email. Your security is our priority.
                </p>
              </div>
            </div>
            <div class="footer">
              <div class="footer-brand">BrainQuest</div>
              <p>Smart Learning, Better Results</p>
              <p style="color: #9ca3af; margin-top: 12px;">
                This is an automated message, please do not reply.
              </p>
            </div>
          </div>
        </body>
        </html>
      `)
      .setText(`
        Hello ${firstName}!
        
        Welcome to BrainQuest! Your verification code is: ${code}
        
        This code will expire in 15 minutes.
        
        If you didn't create an account, please ignore this email.
        
        Best regards,
        BrainQuest Team
      `);

    const response = await mailerSend.email.send(emailParams);
    
    console.log(`✅ Verification email sent successfully to ${email}`);
    console.log(`   Response:`, response.statusCode || 'Success');
    
    return response;

  } catch (error) {
    console.error("❌ Failed to send verification email");
    console.error(`   Error: ${error.message}`);
    
    // MailerSend specific error handling
    if (error.message.includes('domain is not verified')) {
      throw new Error('Domain not verified in MailerSend. Please verify your domain at https://app.mailersend.com/domains');
    } else if (error.message.includes('Unauthenticated') || error.message.includes('401')) {
      throw new Error('Invalid MailerSend API key. Please check MAILERSEND_API_KEY.');
    } else if (error.message.includes('from email')) {
      throw new Error('Invalid sender email. Make sure APP_FROM_EMAIL is from a verified domain.');
    }
    
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

// ===============================
// Send password reset email
// ===============================
exports.sendPasswordResetEmail = async (email, resetUrl, firstName) => {
  try {
    console.log(`📤 Sending password reset email to: ${email}`);

    const sentFrom = new Sender(APP_FROM_EMAIL, APP_FROM_NAME);
    const recipients = [new Recipient(email, firstName)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject('Password Reset Request - BrainQuest')
      .setHtml(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              color: #333; 
              margin: 0; 
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 32px;
              font-weight: 700;
            }
            .content { 
              padding: 50px 40px;
              background: white;
            }
            .greeting {
              font-size: 20px;
              color: #1f2937;
              margin-bottom: 24px;
              font-weight: 600;
            }
            .message {
              font-size: 16px;
              color: #4b5563;
              line-height: 1.7;
              margin-bottom: 24px;
            }
            .button-container {
              text-align: center;
              margin: 40px 0;
            }
            .button { 
              background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
              color: white !important; 
              padding: 16px 40px; 
              text-decoration: none; 
              border-radius: 8px;
              display: inline-block;
              font-weight: 700;
              font-size: 16px;
              box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 8px rgba(220, 38, 38, 0.4);
            }
            .link-box {
              background: #f3f4f6;
              padding: 16px;
              border-radius: 8px;
              word-break: break-all;
              font-size: 13px;
              color: #6b7280;
              margin: 24px 0;
              font-family: 'Courier New', monospace;
            }
            .expiry {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 16px 20px;
              margin: 32px 0;
              border-radius: 6px;
            }
            .expiry-text {
              color: #92400e;
              font-size: 14px;
              margin: 0;
            }
            .security-note {
              background: #f0fdf4;
              border-left: 4px solid #22c55e;
              padding: 16px 20px;
              margin: 24px 0;
              border-radius: 6px;
            }
            .security-text {
              color: #166534;
              font-size: 14px;
              margin: 0;
            }
            .footer {
              padding: 30px 40px;
              background: #f9fafb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            .footer-brand {
              font-weight: 700;
              color: #DC2626;
              font-size: 16px;
              margin-bottom: 8px;
            }
            .footer p {
              margin: 4px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
              <p class="greeting">Hello ${firstName},</p>
              <p class="message">
                We received a request to reset your password for your BrainQuest account. 
                No worries, it happens! Click the button below to create a new password:
              </p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset My Password</a>
              </div>
              
              <p class="message">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <div class="link-box">
                ${resetUrl}
              </div>
              
              <div class="expiry">
                <p class="expiry-text">
                  ⏰ <strong>Time Sensitive:</strong> This link will expire in 1 hour for your security.
                </p>
              </div>
              
              <div class="security-note">
                <p class="security-text">
                  🔒 <strong>Didn't request this?</strong> If you didn't request a password reset, 
                  you can safely ignore this email. Your password will remain unchanged and your account is secure.
                </p>
              </div>
            </div>
            <div class="footer">
              <div class="footer-brand">BrainQuest</div>
              <p>Smart Learning, Better Results</p>
              <p style="color: #9ca3af; margin-top: 12px;">
                This is an automated message, please do not reply.
              </p>
            </div>
          </div>
        </body>
        </html>
      `)
      .setText(`
        Hello ${firstName},
        
        We received a request to reset your password. Click the link below:
        
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this, please ignore this email.
        
        Best regards,
        BrainQuest Team
      `);

    const response = await mailerSend.email.send(emailParams);
    
    console.log(`✅ Password reset email sent successfully to ${email}`);
    console.log(`   Response:`, response.statusCode || 'Success');
    
    return response;

  } catch (error) {
    console.error("❌ Failed to send password reset email");
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('domain is not verified')) {
      throw new Error('Domain not verified in MailerSend.');
    } else if (error.message.includes('Unauthenticated') || error.message.includes('401')) {
      throw new Error('Invalid MailerSend API key.');
    }
    
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};