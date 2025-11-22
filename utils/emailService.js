const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Send verification email with code
exports.sendVerificationEmail = async (email, code, firstName) => {
  try {
    await resend.emails.send({
      from: `${process.env.APP_NAME} <${process.env.APP_FROM_EMAIL}>`,
      to: email,
      subject: "Email Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .code-box { background: white; border: 2px dashed #4F46E5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Email Verification</h1></div>
            <div class="content">
              <p>Hello ${firstName},</p>
              <p>Please use the verification code below:</p>

              <div class="code-box">
                <div class="code">${code}</div>
              </div>

              <p>This code expires in <strong>15 minutes</strong>.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log(`Verification email sent to ${email}`);

  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email");
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, resetUrl, firstName) => {
  try {
    await resend.emails.send({
      from: `${process.env.APP_NAME} <${process.env.APP_FROM_EMAIL}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: auto; padding: 20px; }
            .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { padding: 12px 30px; background: #DC2626; color: white; text-decoration: none; border-radius: 5px; }
            .warning { background: #FEF2F2; border-left: 4px solid #DC2626; padding: 15px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Password Reset</h1></div>
            <div class="content">
              <p>Hello ${firstName},</p>
              <p>Click the button below to reset your password:</p>

              <p style="text-align:center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>

              <p>If button doesn't work, copy this link:</p>
              <p style="word-break: break-all; color:#4F46E5;">${resetUrl}</p>

              <div class="warning">
                <strong>Expires in 1 hour</strong>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log(`Password reset email sent to ${email}`);

  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};
