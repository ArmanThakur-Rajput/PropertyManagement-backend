import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Blog from '../models/Blog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const BLOGS_DATA = [
  {
    title: 'NRI Guide to Buying Property in Pune: FEMA, RBI Rules & Smart Investment Zones in 2025',
    slug: 'nri-guide-buying-property-pune-fema-rbi-2025',
    category: 'NRI Guide',
    date: 'June 28, 2025',
    readTime: '8 min read',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    excerpt: 'Everything an NRI needs to know before investing in Pune real estate — FEMA compliance, RBI guidelines, Power of Attorney, tax implications, and the localities offering the best ROI.',
    content: `## Ultimate Guide for NRIs Buying Premium Homes in Pune

Pune has emerged as one of India's most attractive investment destinations for Non-Resident Indians (NRIs) and Overseas Citizens of India (OCIs). The combination of a booming IT sector, pleasant climate, standard-of-life quality, and high rental yields makes it a premium asset hotspot.

### 1. The Legal Framework: FEMA & RBI Regulations
Under the Foreign Exchange Management Act (FEMA) guidelines issued by the Reserve Bank of India (RBI):
* **Allowed Properties**: NRIs can purchase **residential** and **commercial** properties freely in India.
* **No Approvals Needed**: You do not need any special permission from the RBI or local registries to buy residential/commercial real estate.
* **Restricted Properties**: NRIs **cannot** purchase agricultural land, plantation properties, or farmhouses. These can only be acquired if inherited or received as gifts with special approvals.

### 2. Banking and Remittances
All financial transactions for the purchase must flow through authorized banking channels:
* Payments can be made out of funds held in **NRE (Non-Resident External)**, **NRO (Non-Resident Ordinary)**, or **FCNR (Foreign Currency Non-Repatriable)** accounts.
* No payment can be made in foreign currency notes or traveller's cheques directly to the builder.
* Home loans are fully available for NRIs from Indian banks (SBI, HDFC, ICICI) for up to 75-80% of the property value, repayable through NRE/NRO remittances.

### 3. Remote Purchase via Power of Attorney (PoA)
If you cannot travel to Pune to register the property, you can execute a Power of Attorney:
1. Draft the PoA document naming a trusted representative in India (friend, relative, or lawyer).
2. Get the PoA attested at the Indian Embassy/Consulate in your country of residence, or apostilled if required.
3. Send the physical PoA to India, where it must be registered within 90 days of receipt.
4. Your representative can then sign the purchase agreement and coordinate registration on your behalf.

### 4. Smart Zones for High ROI in Pune
For maximum capital appreciation and rental yield:
* **Koregaon Park & Boat Club Road**: Best for luxury, status, and premium tenant demand.
* **Baner & Balewadi**: Perfect for high-growth tech professionals working in the Western IT corridor.
* **Kharadi & Viman Nagar**: Best for commercial proximity to East Pune's IT hubs.`,
    author: { name: 'Arjun Kapoor', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80' },
    featured: true,
  },
  {
    title: 'Koregaon Park vs Baner vs Aundh: Which Pune Locality Suits Your Luxury Investment?',
    slug: 'koregaon-park-vs-baner-vs-aundh-comparison',
    category: 'Market Insights',
    date: 'June 20, 2025',
    readTime: '7 min read',
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80',
    excerpt: "A detailed locality-by-locality breakdown of Pune's top premium neighbourhoods — comparing price trends, infrastructure, connectivity, and rental yields for NRI investors.",
    content: `## A Comparative Analysis of Pune's Luxury Enclaves

If you are looking to invest in Pune's premium real estate, choosing the right locality is critical. Each locality caters to a distinct profile of residents, yielding different capital returns and rental yields.

### 1. Koregaon Park: The Premium Aristocracy
Koregaon Park remains Pune's most prestigious pin code, famous for its lush green lanes, upscale dining, and high-end lifestyle.
* **Pricing**: Range from ₹16,000 to ₹25,000+ per sq.ft.
* **Best For**: Penthouses, premium apartments, and signature villa properties.
* **Rental Yield**: High. Premium corporate executives prefer Koregaon Park for its social vibe.
* **Vibe**: Elite, cosmopolitan, and vibrant.

### 2. Baner: The Modern Western Growth Hub
Driven by the IT hub boom of Hinjewadi and proximity to the Mumbai-Pune Expressway, Baner has transformed into a upscale urban skyline.
* **Pricing**: Range from ₹9,000 to ₹14,000 per sq.ft.
* **Best For**: Modern 3/4 BHK gated community residences with state-of-the-art clubhouses.
* **Rental Yield**: Stable. Perfect for tech leads and multinational employees.
* **Vibe**: Modern, busy, family-friendly with robust connectivity.

### 3. Aundh: The Serene Legacy Suburb
Aundh is one of Pune's oldest premium suburbs, offering established infrastructure, top-tier schools, and a green canopy.
* **Pricing**: Range from ₹11,000 to ₹16,000 per sq.ft.
* **Best For**: Families looking for quiet, peaceful settings with premium shopping and health facilities nearby.
* **Vibe**: Green, quiet, settled, and traditional.

### Summary Recommendation
* Choose **Koregaon Park** if your priority is ultimate status, premium lifestyle, and long-term land value.
* Choose **Baner** if you seek higher initial rental yields, expressway connectivity to Mumbai, and modern tech-integrated properties.
* Choose **Aundh** if you are purchasing a home for retirement or value established community infrastructure.`,
    author: { name: 'Priya Sharma', image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&q=80' },
    featured: false,
  },
  {
    title: 'Remote Property Management in Pune: How NRIs Can Own Without Being Present',
    slug: 'remote-property-management-pune-nris',
    category: 'NRI Services',
    date: 'June 12, 2025',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    excerpt: "From tenant management and rent collection to maintenance and legal compliance — how HyperRelestix's NRI desk handles your Pune property end-to-end while you live abroad.",
    content: `## Managing Your Pune Real Estate Portfolio from Anywhere in the World

Owning a property in India while living in New York, London, or Dubai often brings structural challenges: finding verified tenants, handling maintenance calls, managing municipal taxes, and monitoring compliance. 

At HyperRelestix, we created a specialized **NRI Property Management Desk** to offer completely hands-free ownership. Here is how we make it happen:

### 1. Complete Tenant Life Cycle Management
We handle the end-to-end leasing workflow:
* **Marketing**: Taking high-definition media tours of your property and listing them across verified networks.
* **Verification**: Conducting background checks, corporate references, and mandatory police verification.
* **Contracts**: Drafting digital lease agreements and handling registering processes remotely.
* **Rent Collection**: Automatically routing rental payments directly into your NRO account monthly.

### 2. Maintenance & Repairs Coordination
No more midnight calls about leaking taps or electrical breakdowns:
* We conduct structured inspect checks twice a year.
* Provide photo and video documentation of the property status.
* Coordinate with a network of verified plumbers, electricians, and painters to get repairs done cost-effectively.

### 3. Legal and Tax Compliance
Managing properties requires complying with local laws:
* We coordinate municipal property tax deposits.
* Handle society meetings and society dues compliance.
* Guide you through NRI tax rules (such as TDS deductions on rental income and tax repatriation compliance).

### Conclusion
By leveraging a professional property management service, you can build a stable passive income portfolio in Pune while focusing on your career and life abroad.`,
    author: { name: 'Rahul Mehta', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80' },
    featured: false,
  }
];

async function seed() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing from backend environment');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');

    // Clear old blogs
    await Blog.deleteMany({});
    console.log('🧹 Cleared existing blogs');

    // Create new blogs
    await Blog.insertMany(BLOGS_DATA);
    console.log('🌱 Seeded 3 luxury real estate articles successfully!');
  } catch (err) {
    console.error('❌ Blog seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB connection closed');
  }
}

seed();
