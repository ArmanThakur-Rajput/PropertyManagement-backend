import express from 'express';
import Faq from '../models/Faq.js';
import { managementPlus } from '../middleware/auth.js';

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
// GET /api/faqs  — active only by default
router.get('/', async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    const faqs = await Faq.find(filter).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
// POST /api/faqs
router.post('/', ...managementPlus, async (req, res) => {
  try {
    const { question, answer, order, isActive } = req.body;
    if (!question?.trim()) return res.status(400).json({ success: false, message: 'Question is required' });
    if (!answer?.trim())   return res.status(400).json({ success: false, message: 'Answer is required' });

    const faq = await Faq.create({ question, answer, order: order ?? 0, isActive });
    res.status(201).json({ success: true, faq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/faqs/:id
router.put('/:id', ...managementPlus, async (req, res) => {
  try {
    const faq = await Faq.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!faq) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, faq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/faqs/:id
router.delete('/:id', ...managementPlus, async (req, res) => {
  try {
    const faq = await Faq.findByIdAndDelete(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'FAQ deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
