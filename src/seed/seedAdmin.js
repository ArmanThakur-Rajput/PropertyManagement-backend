/**
 * Seed: Create First Admin User
 * Run: node src/seed/seedAdmin.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

import User from '../models/User.js';

const ADMIN = {
  name: 'Arman Thakur',
  phone: '7009461912',
  email: 'armanslathia@gmail.com',
  role: 'admin',
  department: 'Management',
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Purana admin delete karo
    const deleted = await User.deleteMany({ role: 'admin' });
    if (deleted.deletedCount > 0) {
      console.log(`🧹 Deleted ${deleted.deletedCount} old admin(s)`);
    }

    // Naya admin banao
    const admin = await User.create(ADMIN);
    console.log(`🔑 Admin created: ${admin.name} | Phone: ${admin.phone}`);

    console.log('✅ Done! Login with phone: 7009461912');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
}

seed();