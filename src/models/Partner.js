import mongoose from 'mongoose';

const partnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  visible: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.model('Partner', partnerSchema);
