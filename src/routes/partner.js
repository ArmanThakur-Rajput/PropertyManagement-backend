import express from 'express';
import Partner from '../models/Partner.js';
import { staffOnly } from '../middleware/auth.js';

const router = express.Router();

// ── Public Routes ────────────────────────────────────────────────────────────
// GET /api/partners - get all visible partners
router.get('/', async (req, res) => {
  try {
    const partners = await Partner.find({ visible: true }).sort({ name: 1 });
    res.json({ success: true, partners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin Routes ─────────────────────────────────────────────────────────────
// GET /api/partners/admin - get all partners (including hidden ones)
router.get('/admin', staffOnly, async (req, res) => {
  try {
    const partners = await Partner.find({}).sort({ name: 1 });
    res.json({ success: true, partners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/partners - add a partner
router.post('/', staffOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Partner name is required' });
    }
    const partner = await Partner.create({ name: name.trim() });
    res.json({ success: true, partner });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Partner already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/partners/:id - toggle visibility or update name
router.put('/:id', staffOnly, async (req, res) => {
  try {
    const { name, visible } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (visible !== undefined) updateData.visible = visible;

    const partner = await Partner.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }
    res.json({ success: true, partner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/partners/:id - delete a partner
router.delete('/:id', staffOnly, async (req, res) => {
  try {
    const partner = await Partner.findByIdAndDelete(req.params.id);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }
    res.json({ success: true, message: 'Partner deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
