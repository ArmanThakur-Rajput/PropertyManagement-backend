/**
 * seedMasterData.js
 * Clears ALL existing city + locality master data, then re-seeds from frontend source of truth.
 * Run: node seedMasterData.js
 */
import mongoose from 'mongoose';
import MasterData from './src/models/MasterData.js';
import dotenv from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log('Connected to MongoDB');

// ── 1. Delete existing entries ────────────────────────────────────────────────
const deleted = await MasterData.deleteMany({
  category: { $in: ['city', 'locality', 'locality_pune', 'locality_pcmc'] },
});
console.log(`Deleted ${deleted.deletedCount} existing city/locality records`);

// ── 2. Fresh data ─────────────────────────────────────────────────────────────
const data = {
  city: [
    'Pune',
    'PCMC',
  ],

  locality_pune: [
    'Koregaon Park', 'KP', 'Kalyani Nagar', 'Viman Nagar', 'Kharadi',
    'Hadapsar', 'Magarpatta', 'Wagholi', 'Undri', 'Kondhwa',
    'Wanowrie', 'NIBM Road', 'Bibwewadi', 'Katraj', 'Dhayari',
    'Ambegaon', 'Warje', 'Kothrud', 'Karve Nagar', 'Erandwane',
    'Deccan', 'Shivajinagar', 'Shivaji Nagar', 'Model Colony', 'Aundh',
    'Baner', 'Balewadi', 'Sus', 'Pashan', 'Bavdhan', 'Bawadhan',
    'Pimple Gurav', 'Dhanori', 'Lohegaon', 'Lohgaon', 'Vishrantwadi',
    'Punewadi', 'Shewalewadi Road', 'MG Road', 'JM Road', 'F.C. Road',
    'Hinjewadi Phase I, II', 'Ravet', 'Ganga Dham Chownk', 'Swargate',
    'Prabhat Road', 'Bhekrai Nagar', 'Handewadi', 'Parvati Hill',
    'Sukhsagar Nagar', 'Singhgad Road', 'Camp', 'Nanded City',
    'Manjari', 'Khadki', 'Fursungi', 'Muhamad Wadi', 'Malwadi',
  ],

  locality_pcmc: [
    'Wakad', 'Hinjewadi', 'Pimple Saudagar', 'Pimple Nilakh',
    'Punawale', 'Tathawade', 'Thergaon', 'Chinchwad', 'Chinchwad Gaon',
    'Pimpri', 'Pimpri Gaon', 'Akurdi', 'Nigdi', 'Pradhikaran', 'Bhosari',
    'Moshi', 'Chakan', 'Dighi', 'Kalewadi', 'Kasarwadi',
    'Dapodi', 'Sangvi', 'Alandi Road', 'Chikhali', 'Charholi',
    'Bhugaon', 'Man',
  ],
};

// ── 3. Insert fresh ──────────────────────────────────────────────────────────
let inserted = 0;
let skipped = 0;

for (const [category, values] of Object.entries(data)) {
  for (const value of values) {
    try {
      await MasterData.create({ category, value });
      inserted++;
    } catch (err) {
      if (err.code === 11000) skipped++;
      else console.error(`Error inserting ${category}:${value}`, err.message);
    }
  }
}

console.log(`Done — inserted: ${inserted}, skipped (duplicate): ${skipped}`);
await mongoose.disconnect();
