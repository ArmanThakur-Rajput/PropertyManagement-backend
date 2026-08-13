import express from 'express';
import Testimonial from '../models/Testimonial.js';
import { managementPlus } from '../middleware/auth.js';

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
// GET /api/testimonials  — active only (for homepage)
router.get('/', async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/testimonials/:id
router.get('/:id', async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, testimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
// POST /api/testimonials
router.post('/', ...managementPlus, async (req, res) => {
  try {
    const { name, city, image, rating, text, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Review text is required' });

    const testimonial = await Testimonial.create({ name, city, image, rating, text, isActive });
    res.status(201).json({ success: true, testimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/testimonials/:id
router.put('/:id', ...managementPlus, async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!testimonial) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, testimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/testimonials/:id
router.delete('/:id', ...managementPlus, async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Testimonial deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
