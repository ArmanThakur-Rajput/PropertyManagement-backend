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
  },
  { timestamps: true }
);

// Fast queries for the listing page
propertySchema.index({ isActive: 1, city: 1, type: 1, price: 1 });
propertySchema.index({ isActive: 1, featured: 1 });

const Property = mongoose.model('Property', propertySchema);
export default Property;
