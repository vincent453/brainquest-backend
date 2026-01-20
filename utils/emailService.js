const transporter = require("./mailer");

// ===============================
// Send verification email
// ===============================
exports.sendVerificationEmail = async (email, code, firstName) => {
  try {
    await transporter.sendMail({
      from: `${process.env.APP_NAME} <${process.env.APP_FROM_EMAIL}>`,
      to: email,
      subject: "Email Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; }
            .code-box { border: 2px dashed #4F46E5; padding: 20px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h2>Email Verification</h2></div>
            <div class="content">
              <p>Hello ${firstName},</p>
              <p>Your verification code is:</p>
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              <p>This code expires in <strong>15 minutes</strong>.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error("❌ Nodemailer verification error:", error);
    throw new Error("Failed to send verification email");
  }
};

// ===============================
// Send password reset email
// ===============================
exports.sendPasswordResetEmail = async (email, resetUrl, firstName) => {
  try {
    await transporter.sendMail({
      from: `${process.env.APP_NAME} <${process.env.APP_FROM_EMAIL}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: auto; padding: 20px; }
            .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; }
            .button { background: #DC2626; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h2>Password Reset</h2></div>
            <div class="content">
              <p>Hello ${firstName},</p>
              <p>Click the button below to reset your password:</p>

              <p style="text-align:center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>

              <p>If the button doesn’t work, copy this link:</p>
              <p style="word-break: break-all;">${resetUrl}</p>

              <p><strong>Expires in 1 hour</strong></p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error("❌ Nodemailer reset error:", error);
    throw new Error("Failed to send password reset email");
  }
};
