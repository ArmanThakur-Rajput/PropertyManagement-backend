import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },

    // ── Role-based access ──────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['client', 'agent', 'management', 'admin'],
      default: 'client',
    },

    // ── Employee-specific ──────────────────────────────────────────────────────
    isActive:   { type: Boolean, default: true },
    department: { type: String, default: '' },   // Sales, Rentals, Management…
    expertise:  { type: String, default: '' },   // Localities they specialize in, e.g. "Koregaon Park"
    qualities:  { type: String, default: '' },   // Agent qualities / special tags, e.g. "Luxury specialist, Great negotiator"
    avatar:     { type: String, default: '' },   // initials fallback on frontend

    // ── User Wishlist ──────────────────────────────────────────────────────────
    wishlist:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1, isActive: 1 });

const User = mongoose.model('User', userSchema);
export default User;
