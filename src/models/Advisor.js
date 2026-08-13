import mongoose from 'mongoose';

const advisorSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    designation: { type: String, default: '', trim: true },
    experience:  { type: Number, default: 0 },
    phone:       { type: String, default: '', trim: true },
    email:       { type: String, default: '', trim: true, lowercase: true },
    image:       { type: String, default: '' },
    localities:  { type: String, default: '', trim: true },  // comma-separated
    qualities:   { type: String, default: '', trim: true },  // comma-separated
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Advisor', advisorSchema);
