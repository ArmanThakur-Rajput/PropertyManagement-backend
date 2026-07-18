import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema({
  note:      { type: String, required: true },
  addedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedByName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const enquirySchema = new mongoose.Schema(
  {
    // ── Who ──────────────────────────────────────────────────────────────────
    name:  { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },

    // ── What type of enquiry ──────────────────────────────────────────────────
    type: {
      type: String,
      enum: ['contact', 'buy', 'sell', 'lease', 'management', 'newsletter'],
      required: true,
    },

    // ── NRI flag ─────────────────────────────────────────────────────────────
    isNRI:       { type: Boolean, default: false },
    countryCode: { type: String, default: '' },

    // ── Contact form fields ───────────────────────────────────────────────────
    subject: { type: String, default: '' },
    message: { type: String, default: '' },

    // ── Buy form fields ───────────────────────────────────────────────────────
    propertyType: { type: String, default: '' },
    locality:     { type: String, default: '' },
    budget:       { type: String, default: '' },
    timing:       { type: String, default: '' },

    // ── Sell form fields ──────────────────────────────────────────────────────
    propertyLocality: { type: String, default: '' },
    propertyArea:     { type: String, default: '' },
    bedrooms:         { type: String, default: '' },
    askingPrice:      { type: String, default: '' },
    furnishing:       { type: String, default: '' },
    images:           [{ type: String }],

    // ── Lease form fields ─────────────────────────────────────────────────────
    leasePurpose: { type: String, default: '' },
    rentRange:    { type: String, default: '' },
    duration:     { type: String, default: '' },

    // ── Management form fields ────────────────────────────────────────────────
    managementTier:     { type: String, default: '' },
    numberOfProperties: { type: String, default: '' },

    // ── Generic notes ─────────────────────────────────────────────────────────
    notes: { type: String, default: '' },

    // ── Lead lifecycle ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['new', 'contacted', 'visited', 'qualified', 'converted', 'lost'],
      default: 'new',
    },

    // ── Assignment (lead_control assigns to employee) ─────────────────────────
    assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedToName: { type: String, default: '' },
    assignedAt:     { type: Date, default: null },

    // ── Follow-up history ─────────────────────────────────────────────────────
    followUps: [followUpSchema],

    // ── Source tracking ───────────────────────────────────────────────────────
    source: { type: String, default: 'website' },

    // ── Property Context (if enquiry is for a specific listing) ───────────────
    propertyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
    propertyTitle: { type: String, default: '' },
  },
  { timestamps: true }
);

enquirySchema.index({ type: 1, status: 1, createdAt: -1 });
enquirySchema.index({ phone: 1 });
enquirySchema.index({ assignedTo: 1, status: 1 });
enquirySchema.index({ status: 1, createdAt: -1 });
enquirySchema.index({ createdAt: -1 });

const Enquiry = mongoose.model('Enquiry', enquirySchema);
export default Enquiry;
