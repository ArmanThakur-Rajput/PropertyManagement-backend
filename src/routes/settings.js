import express from 'express';
import SiteSettings from '../models/SiteSettings.js';
import { managementPlus } from '../middleware/auth.js';

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
// GET /api/settings  — used by frontend SettingsContext to load branding
router.get('/', async (req, res) => {
  try {
    // Always single document — upsert if not exists yet
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = await SiteSettings.create({});
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
// PUT /api/settings  — admin saves full settings object
router.put('/', ...managementPlus, async (req, res) => {
  try {
    const settings = await SiteSettings.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
