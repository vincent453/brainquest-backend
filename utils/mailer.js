// utils/emailService.js
const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});

const APP_FROM_EMAIL = process.env.APP_FROM_EMAIL;
const APP_NAME = process.env.APP_NAME || 'BrainQuest';

exports.sendVerificationEmail = async (email, code, firstName) => {
  const sentFrom = new Sender(APP_FROM_EMAIL, APP_NAME);
  const recipients = [new Recipient(email, firstName)];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject("Email Verification - BrainQuest")
    .setHtml(`Your verification code: <strong>${code}</strong>`)
    .setText(`Your verification code: ${code}`);

  await mailerSend.email.send(emailParams);
};