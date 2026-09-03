import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  id:    { type: String },
  name:  { type: String, default: '' },
  phone: { type: String, default: '' },
}, { _id: false });

const propertySchema = new mongoose.Schema(
  {
    title:      { type: String, required: true, trim: true },
    type:       { type: String, required: true }, // Villa, Apartment, Penthouse, Farm House, Commercial, Plot
    category:   { type: String, default: '' },    // Luxury Villas, Luxury Apartments …

    price:      { type: Number, required: true },
    priceLabel: { type: String, default: '' },    // ₹45 Cr

    location:   { type: String, required: true }, // Worli, Mumbai
    city:       { type: String, required: true }, // Pune (all properties are Pune-based)

    bedrooms:   { type: Number, default: 0 },
    bathrooms:  { type: Number, default: 0 },
    area:       { type: Number, default: 0 },     // sq ft
    parking:    { type: Number, default: 0 },

    image:      { type: String, default: '' },    // primary image URL
    images:     [{ type: String }],               // gallery

    badge:      { type: String, default: '' },    // Featured, New Launch …
    badgeColor: { type: String, default: '' },    // gold, green, blue, red

    status: {
      type: String,
      enum: ['Ready to Move', 'Under Construction', 'Pre-Launch', 'Sold Out'],
      default: 'Ready to Move',
    },

    featured:   { type: Boolean, default: false },

    amenities:  [{ type: String }],
    description:{ type: String, default: '' },

    agent: { type: agentSchema, default: {} },

    yearBuilt:  { type: Number },
    furnishing: { type: String, default: '' }, // Fully Furnished, Semi Furnished, Shell Condition
    facing:     { type: String, default: '' }, // East Facing, West Facing …
    developer:  { type: String, default: '' },
    rera:       { type: String, default: '' },

    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },

    isActive:   { type: Boolean, default: true }, // soft-delete / unpublish

    // ── User listing filter fields ─────────────────────────────────────────────
    listingType:     { type: String, default: '' }, // Rent | Resale | PG/Hostel | Flatmates
    propertyType:    { type: String, default: '' }, // Residential | Commercial | Plot | Villa
    bhkType:         { type: String, default: '' }, // "1 BHK" | "1 RK" | "2 BHK" etc.
    locality:        { type: String, default: '' },
    propertyAge:     { type: String, default: '' },
    availableFrom:   { type: String, default: '' },
    preferredTenant: { type: String, default: '' },
    pgGender:        { type: String, default: '' }, // Male | Female | Any
    roomType:        { type: String, default: '' }, // Single | Double | Triple | Shared
    pgFood:          { type: String, default: '' }, // None | Breakfast | Lunch | Dinner | All Meals
    buildingType:    { type: String, default: '' }, // Commercial Building | Mall | IT Park etc.
    tenantType:      { type: String, default: '' }, // Male | Female | Student | Professional
    plotArea:        { type: String, default: '' }, // sqft/sqyard
    carpetArea:      { type: String, default: '' }, // built-up area
    parkingType:     { type: String, default: '' }, // Two Wheeler | Four Wheeler | Both | Public | Reserved

    // ── User listing detail fields (missing before, now added) ────────────────
    floor:           { type: String, default: '' }, // e.g. "3"
    totalFloor:      { type: String, default: '' }, // e.g. "10"
    ownershipType:   { type: String, default: '' }, // Self Owned | On Lease
    floorType:       { type: String, default: '' }, // Tiles | Marble | Wooden | Cement
    balconies:       { type: String, default: '' }, // "0" | "1" | "2" | "3+"
    pricePerSqft:    { type: String, default: '' }, // e.g. "7000"
    maintenance:     { type: String, default: '' }, // monthly maintenance charges
    deposit:         { type: String, default: '' }, // security deposit
    pgNotice:        { type: String, default: '' }, // 15 Days | 1 Month | 2 Months
    pgRooms:         [{ type: String }],            // ["Single","Double","Triple","Shared"]
    visitTime:       { type: String, default: '' }, // Morning | Afternoon | Evening | Anytime
    visitDays:       [{ type: String }],            // ["Mon","Tue",...]
    scheduleNotes:   { type: String, default: '' },
    // Plot-specific
    plotLength:      { type: String, default: '' },
    plotWidth:       { type: String, default: '' },
    boundaryWall:    { type: String, default: '' }, // Yes | No
    cornerPlot:      { type: String, default: '' }, // Yes | No
    floorsAllowed:   { type: String, default: '' }, // G | G+1 | G+2 ...
    gatedProject:    { type: String, default: '' }, // Yes | No
    // Villa-specific
    villaType:       { type: String, default: '' }, // Independent | Gated Community | Duplex | Row
    // Commercial-specific
    otherFeatures:   [{ type: String }],            // ["On Main Road","Corner Property"]

    // ── Who added this property ────────────────────────────────────────────────
    addedBy: {
      role: { type: String, default: '' }, // 'admin' | 'management'
      name: { type: String, default: '' }, // display name of the user
    },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
// Compound index covers: isActive + city/type filters + price sort
propertySchema.index({ isActive: 1, city: 1, type: 1, price: 1 });

// Featured listings query
propertySchema.index({ isActive: 1, featured: 1 });

// Location regex queries (used in getAllProperties + getPropertyCounts)
propertySchema.index({ isActive: 1, location: 1 });

// Default sort by newest — critical for listing page speed
propertySchema.index({ isActive: 1, createdAt: -1 });

// User listing filter indexes
propertySchema.index({ isActive: 1, listingType: 1 });
propertySchema.index({ isActive: 1, propertyType: 1 });
propertySchema.index({ isActive: 1, bhkType: 1 });
propertySchema.index({ isActive: 1, locality: 1 });
propertySchema.index({ isActive: 1, pgGender: 1 });
propertySchema.index({ isActive: 1, roomType: 1 });
propertySchema.index({ isActive: 1, buildingType: 1 });

// Text index for the search param (replaces slow regex on title/location/city/developer)
propertySchema.index(
  { title: 'text', location: 'text', city: 'text', developer: 'text' },
  { weights: { title: 10, location: 5, city: 3, developer: 2 }, name: 'property_text_search' }
);

const Property = mongoose.model('Property', propertySchema);
export default Property;
