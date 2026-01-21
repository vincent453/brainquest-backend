const transporter = require("./mailer");

// Get configuration from environment
const APP_NAME = process.env.APP_NAME || 'BrainQuest';
const APP_FROM_EMAIL = process.env.APP_FROM_EMAIL;

if (!APP_FROM_EMAIL) {
  console.error('❌ ERROR: APP_FROM_EMAIL not set in environment variables');
  console.error('   Add APP_FROM_EMAIL to your Render environment');
  throw new Error('APP_FROM_EMAIL is required');
}

console.log(`📧 Email service configured with from: ${APP_FROM_EMAIL}`);

// ===============================
// Send verification email
// ===============================
exports.sendVerificationEmail = async (email, code, firstName) => {
  try {
    console.log(`📤 Sending verification email to: ${email}`);
    console.log(`   Code: ${code}`);

    const mailOptions = {
      from: `${APP_NAME} <${APP_FROM_EMAIL}>`,
      to: email,
      subject: "Email Verification Code - BrainQuest",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              color: #333; 
              margin: 0; 
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
              color: white; 
              padding: 30px 20px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px;
              background: white;
            }
            .greeting {
              font-size: 18px;
              color: #1f2937;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              color: #4b5563;
              line-height: 1.6;
              margin-bottom: 30px;
            }
            .code-box { 
              background: #f3f4f6;
              border: 2px dashed #4F46E5; 
              padding: 25px; 
              text-align: center; 
              margin: 30px 0;
              border-radius: 8px;
            }
            .code { 
              font-size: 36px; 
              font-weight: bold; 
              letter-spacing: 8px; 
              color: #4F46E5;
              font-family: 'Courier New', monospace;
            }
            .expiry {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px 16px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .expiry-text {
              color: #92400e;
              font-size: 14px;
              margin: 0;
            }
            .footer {
              padding: 20px 30px;
              background: #f9fafb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 5px 0;
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
                Thank you for signing up for BrainQuest! To complete your registration 
                and verify your email address, please enter the verification code below:
              </p>
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              <div class="expiry">
                <p class="expiry-text">
                  ⏰ <strong>Important:</strong> This code will expire in 15 minutes.
                </p>
              </div>
              <p class="message">
                If you didn't create an account with BrainQuest, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p><strong>BrainQuest Team</strong></p>
              <p>Smart Learning, Better Results</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Verification email sent successfully to ${email}`);
    console.log(`   Message ID: ${info.messageId || 'N/A'}`);
    
    return info;

  } catch (error) {
    console.error("❌ Failed to send verification email");
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    
    // Provide helpful error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Check SENDGRID_API_KEY.');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      throw new Error('Email server connection timeout. Check network/firewall.');
    } else if (error.message && error.message.includes('not verified')) {
      throw new Error('Sender email not verified in SendGrid. Please verify your sender identity.');
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

    const mailOptions = {
      from: `${APP_NAME} <${APP_FROM_EMAIL}>`,
      to: email,
      subject: "Password Reset Request - BrainQuest",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              color: #333; 
              margin: 0; 
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
              color: white; 
              padding: 30px 20px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px;
              background: white;
            }
            .greeting {
              font-size: 18px;
              color: #1f2937;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              color: #4b5563;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            .button-container {
              text-align: center;
              margin: 35px 0;
            }
            .button { 
              background: #DC2626; 
              color: white !important; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 6px;
              display: inline-block;
              font-weight: 600;
              font-size: 16px;
            }
            .button:hover {
              background: #991B1B;
            }
            .link-box {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 6px;
              word-break: break-all;
              font-size: 13px;
              color: #6b7280;
              margin: 20px 0;
            }
            .expiry {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px 16px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .expiry-text {
              color: #92400e;
              font-size: 14px;
              margin: 0;
            }
            .footer {
              padding: 20px 30px;
              background: #f9fafb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 5px 0;
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
                Click the button below to create a new password:
              </p>
              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p class="message">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <div class="link-box">
                ${resetUrl}
              </div>
              <div class="expiry">
                <p class="expiry-text">
                  ⏰ <strong>Important:</strong> This link will expire in 1 hour.
                </p>
              </div>
              <p class="message">
                If you didn't request this password reset, you can safely ignore this email. 
                Your password will remain unchanged.
              </p>
            </div>
            <div class="footer">
              <p><strong>BrainQuest Team</strong></p>
              <p>Smart Learning, Better Results</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Password reset email sent successfully to ${email}`);
    console.log(`   Message ID: ${info.messageId || 'N/A'}`);
    
    return info;

  } catch (error) {
    console.error("❌ Failed to send password reset email");
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Check SENDGRID_API_KEY.');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      throw new Error('Email server connection timeout. Check network/firewall.');
    } else if (error.message && error.message.includes('not verified')) {
      throw new Error('Sender email not verified in SendGrid. Please verify your sender identity.');
    }
    
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};  