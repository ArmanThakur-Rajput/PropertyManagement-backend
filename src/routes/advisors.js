import express from 'express';
import Advisor from '../models/Advisor.js';
import { managementPlus } from '../middleware/auth.js';

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
// GET /api/advisors  — active only by default
router.get('/', async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    const advisors = await Advisor.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, advisors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/advisors/:id
router.get('/:id', async (req, res) => {
  try {
    const advisor = await Advisor.findById(req.params.id);
    if (!advisor) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, advisor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
// POST /api/advisors
router.post('/', ...managementPlus, async (req, res) => {
  try {
    const { name, designation, experience, phone, email, image, localities, qualities, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    const advisor = await Advisor.create({
      name, designation, experience, phone, email, image, localities, qualities, isActive,
    });
    res.status(201).json({ success: true, advisor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/advisors/:id
router.put('/:id', ...managementPlus, async (req, res) => {
  try {
    const advisor = await Advisor.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!advisor) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, advisor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/advisors/:id
router.delete('/:id', ...managementPlus, async (req, res) => {
  try {
    const advisor = await Advisor.findByIdAndDelete(req.params.id);
    if (!advisor) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Advisor deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
