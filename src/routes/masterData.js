import express from 'express';
import MasterData from '../models/MasterData.js';
import { managementPlus, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
// GET /api/master-data/list  — all items grouped by category (used by frontend dropdowns)
router.get('/list', async (req, res) => {
  try {
    const items = await MasterData.find({}).sort({ category: 1, value: 1 });
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/master-data  — all items grouped by category (used by frontend dropdowns)
router.get('/', async (req, res) => {
  try {
    const items = await MasterData.find({}).sort({ category: 1, value: 1 });

    // Group by category → { city: [], locality_pune: [], locality_pcmc: [], ... }
    const data = {};
    for (const item of items) {
      if (!data[item.category]) data[item.category] = [];
      data[item.category].push(item.value);
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
// POST /api/master-data
router.post('/', ...adminOnly, async (req, res) => {
  try {
    const { category, value } = req.body;
    if (!category?.trim()) return res.status(400).json({ success: false, message: 'Category is required' });
    if (!value?.trim())    return res.status(400).json({ success: false, message: 'Value is required' });

    const item = await MasterData.create({ category: category.trim(), value: value.trim() });
    res.status(201).json({ success: true, item });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'This value already exists in this category' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/master-data/:id
router.put('/:id', ...adminOnly, async (req, res) => {
  try {
    const { value, category } = req.body;
    const update = {};
    if (value !== undefined)    update.value    = value.trim();
    if (category !== undefined) update.category = category.trim();

    const item = await MasterData.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, item });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'This value already exists in this category' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/master-data/:id
router.delete('/:id', ...adminOnly, async (req, res) => {
  try {
    const item = await MasterData.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
