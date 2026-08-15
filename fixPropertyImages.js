/**
 * One-time migration: fix properties where image is empty but images[] has URLs
 * Run: node fixPropertyImages.js
 */
import mongoose from 'mongoose';
import Property from './src/models/Property.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI not found in .env — check your .env file path');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
console.log('Connected to MongoDB');

const result = await Property.updateMany(
  { image: '', images: { $exists: true, $ne: [] } },
  [{ $set: { image: { $arrayElemAt: ['$images', 0] } } }]
);

console.log(`Fixed ${result.modifiedCount} properties`);
await mongoose.disconnect();
