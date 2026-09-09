import mongoose from 'mongoose';

const errorLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['JS_CRASH', 'NOT_FOUND', 'API_ERROR'],
    required: true,
  },
  // Common fields
  url:       { type: String },
  referrer:  { type: String },
  userAgent: { type: String },
  time:      { type: String },

  // JS_CRASH specific
  message:        { type: String },
  stack:          { type: String },
  componentStack: { type: String },

  // API_ERROR specific
  endpoint: { type: String },
  status:   { type: Number },

  // NOT_FOUND specific
  path: { type: String },

}, { timestamps: true });

export default mongoose.model('ErrorLog', errorLogSchema);
