import mongoose from 'mongoose';

/**
 * UserListing — stores a property owner's ad submission.
 *
 * LIFECYCLE:
 *   draft     → user is mid-wizard; lead captured, listing incomplete
 *   submitted → user clicked "Submit Listing"; goes to admin review
 *   active    → admin approved; visible to buyers
 *   rejected  → admin rejected with reason
 *   removed   → owner deleted their own draft
 *
 * "draft" listings are saved step-by-step so the owner can
 * leave mid-way and resume without re-filling the lead form.
 */

const userListingSchema = new mongoose.Schema(
  {
    // ── Owner identity (captured in Phase-1 lead form) ─────────────────────────
    ownerName:  { type: String, required: true, trim: true },
    ownerPhone: { type: String, required: true, trim: true },
    ownerEmail: { type: String, trim: true, lowercase: true, default: '' },

    // ── Listing meta ───────────────────────────────────────────────────────────
    propertyType: {
      type: String,
      enum: ['Residential', 'Commercial', 'Plot/Villa', 'Plot', 'Villa'],
      required: true,
    },
    adType: {
      type: String,
      enum: ['Rent', 'Resale', 'PG/Hostel', 'Flatmates', 'Sale'],
      required: true,
    },

    // ── Wizard progress ────────────────────────────────────────────────────────
    currentStep:   { type: Number, default: 0 },   // which step the user is on
    completedSteps:{ type: [Number], default: [] }, // indices of saved steps

    // ── Status ─────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['draft', 'submitted', 'active', 'rejected', 'removed'],
      default: 'draft',
    },
    adminNote: { type: String, default: '' }, // rejection reason from admin

    // ── Step data: Property Details ────────────────────────────────────────────
    villaType:              { type: String, default: '' },  // Villa-specific
    plotArea:               { type: String, default: '' },  // Villa-specific
    apartmentType:          { type: String, default: '' },
    bhkType:                { type: String, default: '' },
    ownershipType:          { type: String, default: '' },
    floorType:              { type: String, default: '' },
    floor:                  { type: String, default: '' },
    totalFloor:             { type: String, default: '' },
    propertyAge:            { type: String, default: '' },
    facing:                 { type: String, default: '' },
    area:                   { type: String, default: '' },
    carpetArea:             { type: String, default: '' },
    furnishing:             { type: String, default: '' },
    pgRooms:                [{ type: String }],
    roomType:               { type: String, default: '' },
    tenantType:             { type: String, default: '' },
    commercialPropertyType: { type: String, default: '' },
    buildingType:           { type: String, default: '' },
    otherFeatures:          [{ type: String }],
    plotLength:             { type: String, default: '' },
    plotWidth:              { type: String, default: '' },
    boundaryWall:           { type: String, default: '' },
    cornerPlot:             { type: String, default: '' },
    floorsAllowed:          { type: String, default: '' },
    gatedProject:           { type: String, default: '' },

    // ── Step data: Location ────────────────────────────────────────────────────
    city:     { type: String, default: '' },
    locality: { type: String, default: '' },
    society:  { type: String, default: '' },
    flatNo:   { type: String, default: '' },
    landmark: { type: String, default: '' },

    // ── Step data: Pricing ─────────────────────────────────────────────────────
    price:           { type: String, default: '' },
    deposit:         { type: String, default: '' },
    pricePerSqft:    { type: String, default: '' },
    maintenance:     { type: String, default: '' },
    availableFrom:   { type: String, default: '' },
    preferredTenant: { type: String, default: '' },
    pgFood:          { type: String, default: '' },
    pgGender:        { type: String, default: '' },
    pgNotice:        { type: String, default: '' },
    pgName:          { type: String, default: '' },

    // ── Step data: Resale extras ───────────────────────────────────────────────
    loanAvailable:   { type: String, default: '' },
    transactionType: { type: String, default: '' },
    underLoan:       { type: String, default: '' },
    balconies:       { type: String, default: '' },
    bathrooms:       { type: String, default: '' },
    parking:         { type: String, default: '' },
    additionalNotes: { type: String, default: '' },

    // ── Step data: Common ──────────────────────────────────────────────────────
    description: { type: String, default: '' },
    amenities:   [{ type: String }],

    // ── Step data: Media (Cloudflare R2 URLs) ──────────────────────────────────
    // After upload, frontend sends back R2 public URLs; stored here
    images: [{ type: String }],  // ordered list; index 0 = cover
    videos: [{ type: String }],  // optional video URLs

    // ── Step data: Schedule ────────────────────────────────────────────────────
    visitTime:     { type: String, default: '' },
    visitDays:     [{ type: String }],
    scheduleNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Find all drafts by phone quickly
userListingSchema.index({ ownerPhone: 1, status: 1 });

// Admin queue: submitted listings ordered by time
userListingSchema.index({ status: 1, createdAt: -1 });

const UserListing = mongoose.model('UserListing', userListingSchema);
export default UserListing;
