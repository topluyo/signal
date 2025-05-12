// At the top, after your requires:
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a reusable transporter using SMTP (e.g. Gmail, SendGrid, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,      // e.g. "smtp.gmail.com"
  port: parseInt(process.env.MAIL_PORT) || 587,
  secure: process.env.MAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USER,    // your SMTP username
    pass: process.env.MAIL_PASS     // your SMTP password or API key
  }
});

// Helper to send an email
function sendErrorEmail(subject, htmlBody) {
  const mailOptions = {
    from: `"SocketServer Error" <${process.env.MAIL_FROM}>`, // e.g. no-reply@yourdomain.com
    to: process.env.MAIL_TO,    // comma-separated list of recipients
    subject,
    html: htmlBody
  };
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('❌ Error sending error-report email:', err);
    } else {
      console.log('✅ Error-report email sent:', info.messageId);
    }
  });
}

function wrapHandler(socket, eventName, handler) {
  return async (...args) => {
    try {
      await handler.apply(socket, args);
    } catch (err) {
      console.error(`Error in ${eventName}:`, err);
      const body = `
        <h2>Socket.IO Error</h2>
        <p><strong>Namespace:</strong> ${socket.nsp.name}</p>
        <p><strong>Socket ID:</strong> ${socket.id}</p>
        <p><strong>Event:</strong> ${eventName}</p>
        <p><strong>Args:</strong><pre>${JSON.stringify(args, null, 2)}</pre></p>
        <p><strong>Stack:</strong><pre>${err.stack}</pre></p>
        <p><em>Time: ${new Date().toISOString()}</em></p>
      `;
      sendErrorEmail(`Socket.IO Error: ${eventName}`, body);
    }
  };
}

exports.wrapHandler = wrapHandler;