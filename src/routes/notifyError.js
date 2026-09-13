import express from 'express';
import { Resend } from 'resend';
import ErrorLog from '../models/ErrorLog.js';
import { adminOnly } from '../middleware/auth.js';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'hello@kinpropertymanagement.com';
const FROM_EMAIL  = process.env.FROM_EMAIL  || 'alerts@kinpropertymanagement.com';

// ── In-memory deduplication (same alert, same key → 1 email per 10 min) ──────
// Production mein Redis use karo agar multiple server instances hain.
const recentAlerts = new Map();
const DEDUPE_TTL = 10 * 60 * 1000; // 10 minutes

// Auto-clean old entries every 15 min so Map memory leak nahi hoti
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentAlerts.entries()) {
    if (now - ts > DEDUPE_TTL) recentAlerts.delete(key);
  }
}, 15 * 60 * 1000);

// ── Email templates ──────────────────────────────────────────────────────────

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
    subject: `🟡 Broken Internal Link — ${d.path}`,
    html: `
      <h2 style="color:#d97706">Broken Internal Link Found</h2>
      <p style="color:#374151;font-size:14px">
        Ye 404 teri apni site ke ek page se aa raha hai — matlab wahan ek broken link hai jise fix karna chahiye.
      </p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Broken Path</td><td style="padding:8px;border:1px solid #e5e7eb">${d.path || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Full URL</td><td style="padding:8px;border:1px solid #e5e7eb">${d.url || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Came From (Referrer)</td><td style="padding:8px;border:1px solid #e5e7eb">${d.referrer || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #e5e7eb">${d.time || '-'}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;margin-top:16px">
        Referrer page pe jao aur us link ko fix karo jo <strong>${d.path}</strong> point kar raha hai.
      </p>
    `,
  }),

  API_ERROR: (d) => ({
    subject: `🔴 Server Error ${d.status} — ${d.endpoint}`,
    html: `
      <h2 style="color:#dc2626">Server-Side API Error (5xx)</h2>
      <p style="color:#374151;font-size:14px">
        Ye ek genuine server error hai — user ki galti nahi, backend mein kuch toot gaya hai.
      </p>
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

    // 1. DB mein hamesha save karo (admin panel ke liye)
    await ErrorLog.create({ type, ...details });

    // 2. Deduplication check — same alert 10 min mein sirf ek baar email
    const dedupeKey = `${type}:${details.endpoint || details.path || details.url || ''}`;
    const lastSent = recentAlerts.get(dedupeKey);
    if (lastSent && Date.now() - lastSent < DEDUPE_TTL) {
      // DB mein save hua, email skip — silently succeed
      return res.json({ success: true });
    }
    recentAlerts.set(dedupeKey, Date.now());

    // 3. Email bhejo via Resend
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
    res.json({ success: true });
  }
});

// ── GET /api/admin/error-logs (admin only) ───────────────────────────────────
router.get('/admin/error-logs', adminOnly, async (req, res) => {
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
