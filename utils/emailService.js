const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail', // 'gmail', 'outlook', etc.
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD // Use App Password for Gmail
    }
  });
};

// Send verification email with code
exports.sendVerificationEmail = async (email, code, firstName) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Email Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
            .code-box { background-color: white; border: 2px dashed #4F46E5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
            .code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
            </div>
            <div class="content">
              <p>Hello ${firstName},</p>
              <p>Thank you for registering! Please use the verification code below to verify your email address:</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <p>This code will expire in <strong>15 minutes</strong>.</p>
              <p>If you didn't create an account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'Your App'}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, resetUrl, firstName) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background-color: #B91C1C; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            .warning { background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello ${firstName},</p>
              <p>We received a request to reset your password. Click the button below to reset it:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in <strong>1 hour</strong>.
              </div>
              
              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'Your App'}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
    
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};