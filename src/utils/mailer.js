import nodemailer from 'nodemailer';

/**
 * Sends an email using SMTP if configured in .env, otherwise logs to the console.
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Subject of email
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML markup content
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  const { RESEND_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  // 1. Try Resend HTTP API first (bypasses SMTP port blocks on Render/Heroku)
  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: SMTP_FROM || 'onboarding@resend.dev',
          to,
          subject,
          html,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.info(`✉️ Email sent successfully via Resend to ${to}. ID: ${data.id}`);
        return true;
      } else {
        console.error(`❌ Resend API failed:`, data.message || response.statusText);
      }
    } catch (err) {
      console.error(`❌ Resend sending to ${to} failed:`, err.message);
    }
  }

  // 2. Try Brevo (Sendinblue) HTTP API (does NOT require custom domain, sends to anyone!)
  const { BREVO_API_KEY } = process.env;
  if (BREVO_API_KEY) {
    try {
      const senderEmail = SMTP_FROM && SMTP_FROM.includes('<')
        ? SMTP_FROM.match(/<([^>]+)>/)?.[1]
        : (SMTP_USER && SMTP_USER.includes('@') ? SMTP_USER : 'akaygill64@gmail.com');

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'HyperRelestix', email: senderEmail },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.info(`✉️ Email sent successfully via Brevo to ${to}. Message ID: ${data.messageId}`);
        return true;
      } else {
        console.error(`❌ Brevo API failed:`, data.message || JSON.stringify(data));
      }
    } catch (err) {
      console.error(`❌ Brevo sending to ${to} failed:`, err.message);
    }
  }

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        connectionTimeout: 5000, // 5 seconds
        greetingTimeout: 5000,   // 5 seconds
        socketTimeout: 5000,     // 5 seconds
      });

      const info = await transporter.sendMail({
        from: SMTP_FROM || '"HyperRelestix" <noreply@hyperrelestix.com>',
        to,
        subject,
        text,
        html,
      });

      console.info(`✉️ Email sent successfully to ${to}. Message ID: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error(`❌ Email sending to ${to} failed:`, err.message);
    }
  }

  // Development Fallback: output to console
  console.info('\n' + '═'.repeat(60));
  console.info(`📧 [MOCKED EMAIL DELIVERY] To: ${to}`);
  console.info(`📝 Subject: ${subject}`);
  console.info(`💬 Message: ${text}`);
  console.info('═'.repeat(60) + '\n');
  return false;
};
