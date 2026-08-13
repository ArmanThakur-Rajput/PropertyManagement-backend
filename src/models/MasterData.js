import mongoose from 'mongoose';

const masterDataSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      // e.g. 'locality', 'propertyType', 'amenity', 'bhkType', etc.
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Unique per category+value combo
masterDataSchema.index({ category: 1, value: 1 }, { unique: true });

export default mongoose.model('MasterData', masterDataSchema);
