import express from 'express';
import { Resend } from 'resend';
import ErrorLog from '../models/ErrorLog.js';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// ── Email templates ──────────────────────────────────────────────────────────

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'hello@kinpropertymanagement.com';
const FROM_EMAIL  = process.env.FROM_EMAIL  || 'alerts@kinpropertymanagement.com';

const templates = {
  JS_CRASH: (d) => ({
    subject: `🔴 JS Crash — ${d.url}`,
    html: `
      <h2 style="color:#dc2626">JS Crash Detected</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">URL</td><td style="padding:8px;border:1px solid #e5e7eb">${d.url || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Error</td><td style="padding:8px;border:1px solid #e5e7eb">${d.message || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #e5e7eb">${d.time || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Referrer</td><td style="padding:8px;border:1px solid #e5e7eb">${d.referrer || 'Direct'}</td></tr>
      </table>
      ${d.stack ? `<h3>Stack Trace</h3><pre style="background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font-size:12px">${d.stack}</pre>` : ''}
      ${d.componentStack ? `<h3>Component Stack</h3><pre style="background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font-size:12px">${d.componentStack}</pre>` : ''}
    `,
  }),

  NOT_FOUND: (d) => ({
    subject: `🟡 404 Hit — ${d.path}`,
    html: `
      <h2 style="color:#d97706">404 Page Hit</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Path</td><td style="padding:8px;border:1px solid #e5e7eb">${d.path || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Full URL</td><td style="padding:8px;border:1px solid #e5e7eb">${d.url || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Referrer</td><td style="padding:8px;border:1px solid #e5e7eb">${d.referrer || 'Direct / Unknown'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #e5e7eb">${d.time || '-'}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;margin-top:16px">
        Agar referrer teri apni site ka page hai, toh wahan broken link hai — fix karo.
      </p>
    `,
  }),

  API_ERROR: (d) => ({
    subject: `🟠 API Error ${d.status} — ${d.endpoint}`,
    html: `
      <h2 style="color:#ea580c">API Error Detected</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Endpoint</td><td style="padding:8px;border:1px solid #e5e7eb">${d.endpoint || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Status</td><td style="padding:8px;border:1px solid #e5e7eb">${d.status || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Message</td><td style="padding:8px;border:1px solid #e5e7eb">${d.message || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Page URL</td><td style="padding:8px;border:1px solid #e5e7eb">${d.url || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #e5e7eb">${d.time || '-'}</td></tr>
      </table>
    `,
  }),
};

// ── POST /api/notify-error ───────────────────────────────────────────────────
router.post('/notify-error', async (req, res) => {
  try {
    const { type, ...details } = req.body;

    if (!type || !templates[type]) {
      return res.status(400).json({ success: false, message: 'Invalid error type' });
    }

    // 1. DB mein save karo
    await ErrorLog.create({ type, ...details });

    // 2. Email bhejo via Resend
    const { subject, html } = templates[type](details);
    await resend.emails.send({
      from: FROM_EMAIL,
      to:   ALERT_EMAIL,
      subject,
      html,
    });

    res.json({ success: true });
  } catch (err) {
    // Silently fail — client ko kabhi error mat dikhao
    console.error('notify-error failed:', err.message);
    res.json({ success: true }); // client ko pata nahi chalna chahiye
  }
});

// ── GET /api/admin/error-logs (admin only) ───────────────────────────────────
// Apna existing adminAuth middleware yahan use karo
router.get('/admin/error-logs', async (req, res) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const filter = type ? { type } : {};

    const logs = await ErrorLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ErrorLog.countDocuments(filter);

    res.json({ success: true, logs, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
