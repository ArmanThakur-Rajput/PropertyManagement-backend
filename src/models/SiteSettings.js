import mongoose from 'mongoose';

const siteSettingsSchema = new mongoose.Schema(
  {
    // ── Logo & Branding ────────────────────────────────────────────────────────
    logoIconImage:       { type: String, default: '' },
    logoIconText:        { type: String, default: '' },
    logoSubtitle:        { type: String, default: '' },
    logoTextPrimary:     { type: String, default: '' },
    logoTextSecondary:   { type: String, default: '' },
    logoFaviconUrl:      { type: String, default: '' },

    // ── SEO ───────────────────────────────────────────────────────────────────
    metaTitleSuffix:     { type: String, default: '' },
    metaDescription:     { type: String, default: '' },

    // ── Hero Section ──────────────────────────────────────────────────────────
    heroTagline:             { type: String, default: '' },
    heroTitleLine1:          { type: String, default: '' },
    heroTitleLine2Highlight: { type: String, default: '' },
    heroTitleLine3:          { type: String, default: '' },
    heroDescription:         { type: String, default: '' },
    heroVideoUrl:            { type: String, default: '' },
    heroMobileImageUrl:      { type: String, default: '' },

    // ── Contact ───────────────────────────────────────────────────────────────
    contactPhone1:              { type: String, default: '' },
    contactPhone2:              { type: String, default: '' },
    contactEmail1:              { type: String, default: '' },
    contactEmail2:              { type: String, default: '' },
    contactWhatsApp:            { type: String, default: '' },
    contactAddress:             { type: String, default: '' },
    contactOfficeHoursWeekdays: { type: String, default: '' },
    contactOfficeHoursSunday:   { type: String, default: '' },

    // ── Stats Strip ───────────────────────────────────────────────────────────
    stats: {
      experience:     { type: Number, default: 0 },
      propertiesSold: { type: Number, default: 0 },
      happyClients:   { type: Number, default: 0 },
      dealsClosed:    { type: Number, default: 0 },
    },

    // ── Social Links ──────────────────────────────────────────────────────────
    socials: {
      instagram: { type: String, default: '' },
      linkedin:  { type: String, default: '' },
      facebook:  { type: String, default: '' },
      twitter:   { type: String, default: '' },
      youtube:   { type: String, default: '' },
      whatsapp:  { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('SiteSettings', siteSettingsSchema);
