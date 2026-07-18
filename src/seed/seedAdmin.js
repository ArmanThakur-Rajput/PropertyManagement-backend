/**
 * Seed: Create First Admin User
 * Run: node src/seed/seedAdmin.js
 *
 * Creates the first admin account if none exists.
 * Edit ADMIN below before running.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

import User from '../models/User.js';

const ADMIN = {
  name: 'Admin User',
  phone: '9999999999',   // ← change this to your actual phone
  email: 'admin@hyperrelestix.com',
  role: 'admin',
  department: 'Management',
};

const DEMO_STAFF = [
  { name: 'Management User', phone: '9999999998', email: 'management@hyperrelestix.com', role: 'management', department: 'Management' },
  { name: 'Arjun Kapoor', phone: '9999999991', email: 'arjun@hyperrelestix.com', role: 'agent', department: 'Sales', expertise: 'KP, Kalyani Nagar, Viman Nagar' },
  { name: 'Priya Sharma', phone: '9999999992', email: 'priya@hyperrelestix.com', role: 'agent', department: 'Sales', expertise: 'Baner, Balewadi, Pashan' },
  { name: 'Rahul Mehta', phone: '9999999993', email: 'rahul@hyperrelestix.com', role: 'agent', department: 'Sales', expertise: 'Wakad, Hinjewadi, Bavdhan, Bawadhan' },
  { name: 'Anjali Desai', phone: '9999999994', email: 'anjali@hyperrelestix.com', role: 'agent', department: 'Sales', expertise: 'Kothrud, Karve Nagar, Prabhat Road' },
  { name: 'Rohan Joshi', phone: '9999999995', email: 'rohan@hyperrelestix.com', role: 'agent', department: 'Sales', expertise: 'Kharadi, Hadapsar, Wagholi' },
  { name: 'Sneha Patil', phone: '9999999996', email: 'sneha@hyperrelestix.com', role: 'agent', department: 'Sales', expertise: 'NIBM Road, Kondhwa, Undri, Swargate' },
  { name: 'Vikram Singh', phone: '9999999997', email: 'vikram@hyperrelestix.com', role: 'agent', department: 'Sales', expertise: 'Shivaji Nagar, Prabhat Road, Nanded City' },
  { name: 'Neha Gupta', phone: '9999999990', email: 'neha@hyperrelestix.com', role: 'agent', department: 'Sales', expertise: 'Pimple Saudagar, Pimple Gurav, Ravet' }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Clean up old roles if they exist
    const deleteResult = await User.deleteMany({ role: { $in: ['employee', 'lead_control'] } });
    if (deleteResult.deletedCount > 0) {
      console.log(`🧹 Deleted ${deleteResult.deletedCount} leftover employee & lead_control accounts`);
    }

    // Admin
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log(`ℹ️  Admin already exists: ${existingAdmin.name} (${existingAdmin.phone})`);
    } else {
      const admin = await User.create(ADMIN);
      console.log(`🔑 Admin created: ${admin.name} | Phone: ${admin.phone}`);
    }

    // Demo staff (safe to re-run — upserts by phone)
    for (const staff of DEMO_STAFF) {
      await User.findOneAndUpdate(
        { phone: staff.phone },
        staff,
        { upsert: true, new: true }
      );
      console.log(`👤 Staff ensured: ${staff.name} (${staff.role})`);
    }

    // Default partners seed list
    const Partner = (await import('../models/Partner.js')).default;
    const partnerCount = await Partner.countDocuments();
    if (partnerCount === 0) {
      const defaultPartners = [
        { name: 'Panchshil Realty' },
        { name: 'Kolte-Patil' },
        { name: 'Godrej Properties' },
        { name: 'Lodha Pune' },
        { name: 'Goel Ganga' },
        { name: 'Kumar Properties' },
        { name: 'Rohan Builders' },
        { name: 'Majestique Landmarks' }
      ];
      await Partner.create(defaultPartners);
      console.log('✅ Seeded default developer partners successfully');
    } else {
      console.log(`ℹ️  Developer partners already seeded (${partnerCount} found)`);
    }

    console.log('\n✅ Done! Sign in at /admin/login with any of these phone numbers.');
    console.log('   Admin:        9999999999');
    console.log('   Management:   9999999998');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
}

seed();
