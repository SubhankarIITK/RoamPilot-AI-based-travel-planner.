import nodemailer from 'nodemailer';

let transporter;

export const normalizeSmtpPassword = value =>
  String(value || '').replace(/\s+/g, '');

export const isEmailConfigured = () => Boolean(
  process.env.SMTP_URL ||
  (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  )
);

const getTransporter = () => {
  if (transporter) return transporter;
  if (!isEmailConfigured()) {
    throw new Error('SMTP configuration is missing');
  }
  transporter = process.env.SMTP_URL
    ? nodemailer.createTransport(process.env.SMTP_URL)
    : nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        auth: {
          user: String(process.env.SMTP_USER || '').trim(),
          // Google displays App Passwords in four groups. SMTP expects the
          // underlying 16-character value without presentation whitespace.
          pass: normalizeSmtpPassword(process.env.SMTP_PASS),
        },
      });
  return transporter;
};

export const verifyEmailConnection = async () => {
  await getTransporter().verify();
  return true;
};

export const sendEmailConnectionTest = async to =>
  getTransporter().sendMail({
    from: fromAddress(),
    to,
    subject: 'RoamPilot email connection test',
    text: 'RoamPilot successfully connected to your SMTP account. Signup and password-reset OTP emails can now be delivered.',
  });

const fromAddress = () =>
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  `RoamPilot <${process.env.SMTP_USER}>`;

const otpPurposeCopy = purpose => purpose === 'verify-email'
  ? {
      subject: 'Verify your RoamPilot email',
      heading: 'Verify your email',
      action: 'finish creating your RoamPilot account',
    }
  : {
      subject: 'Reset your RoamPilot password',
      heading: 'Reset your password',
      action: 'reset your RoamPilot password',
    };

export const sendOtpEmail = async ({ to, code, purpose }) => {
  const copy = otpPurposeCopy(purpose);
  return getTransporter().sendMail({
    from: fromAddress(),
    to,
    subject: copy.subject,
    text: `Your RoamPilot verification code is ${code}. It expires in 10 minutes. Use it to ${copy.action}. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#10251f">
        <div style="font-size:13px;font-weight:700;letter-spacing:.14em;color:#059669">ROAMPILOT</div>
        <h1 style="font-size:24px;margin:16px 0 8px">${copy.heading}</h1>
        <p style="line-height:1.6;color:#52645e">Use this code to ${copy.action}. It expires in 10 minutes.</p>
        <div style="margin:24px 0;padding:18px;border-radius:14px;background:#ecfdf5;text-align:center;font-size:32px;font-weight:800;letter-spacing:.22em;color:#065f46">${code}</div>
        <p style="font-size:13px;line-height:1.6;color:#718079">If you did not request this code, you can safely ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordChangedEmail = async to =>
  getTransporter().sendMail({
    from: fromAddress(),
    to,
    subject: 'Your RoamPilot password was changed',
    text: 'Your RoamPilot password was changed. If this was not you, contact support immediately.',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#10251f">
        <h1 style="font-size:24px">Password changed</h1>
        <p style="line-height:1.6;color:#52645e">Your RoamPilot password was changed. If this was not you, contact support immediately.</p>
      </div>
    `,
  });

export const resetEmailTransportForTests = () => {
  transporter = undefined;
};
