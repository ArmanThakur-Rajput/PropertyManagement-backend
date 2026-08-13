import mongoose from 'mongoose';

const testimonialSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    city:     { type: String, default: '', trim: true },
    image:    { type: String, default: '' },
    rating:   { type: Number, default: 5, min: 1, max: 5 },
    text:     { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Testimonial', testimonialSchema);
