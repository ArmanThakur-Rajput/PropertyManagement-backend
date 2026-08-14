/**
 * propertyController.js
 *
 * Handles the admin-managed "luxury property" listings (existing flow).
 * Also exposes a buyer-facing search with all filters the Properties page uses.
 *
 * GET /api/properties
 *   Filters: type, city, minPrice, maxPrice, bedrooms, bathrooms,
 *            furnishing, status, featured, search
 *   Sort:    newest | price-asc | price-desc | area-desc
 *   Pagination: page, limit
 */

import Property from '../models/Property.js';

const LIST_FIELDS =
  'title type price priceLabel location city image badge badgeColor status featured ' +
  'bedrooms bathrooms area parking agent yearBuilt developer rera coordinates createdAt furnishing addedBy';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties  — buyer-facing listing with filters
// ─────────────────────────────────────────────────────────────────────────────
export const getAllProperties = async (req, res) => {
  try {
    const {
      type, city,
      minPrice, maxPrice,
      bedrooms, bathrooms,
      furnishing, status,
      featured, search,
      sort = 'newest',
      page = 1, limit = 20,
    } = req.query;

    const filter = { isActive: true };

    // ── Type filter (Villa, Apartment, Penthouse…) ─────────────────────────
    if (type && type !== 'All') filter.type = type;

    // ── City / locality filter ─────────────────────────────────────────────
    if (city && city !== 'All') {
      const LOCALITIES = [
        'Balewadi', 'Hadapsar', 'KP', 'NIBM Road', 'Viman Nagar', 'Kharadi',
        'Punewadi', 'Kothrud', 'Karve Nagar', 'Shewalewadi Road', 'Baner',
        'Pashan', 'Bawadhan', 'MG Road', 'JM Road', 'F.C. Road',
        'Hinjewadi Phase I, II', 'Ravet', 'Ganga Dham Chownk', 'Swargate',
        'Katraj', 'Prabhat Road', 'Bibwewadi', 'Bhekrai Nagar', 'Pimple Gurav',
        'Pimple Saudagar', 'Dhayari', 'Kondhwa', 'Undri', 'Muhamad wadi',
        'Handewadi', 'Wakad', 'Shivaji Nagar', 'Parvati Hill', 'Sukhsagar Nagar',
        'Singhgad Road', 'Camp', 'Pimpri Gaon', 'Chinchwad Gaon', 'Bhosari',
        'Nigdi', 'Bhugaon', 'Man', 'Sus', 'Malwadi', 'Warje', 'Fursungi',
        'Wagholi', 'Manjari', 'Lohgaon', 'Vishrantwadi', 'Khadki', 'Nanded City',
      ];
      if (LOCALITIES.includes(city)) {
        filter.location = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      } else {
        filter.city = city;
      }
    }

    // ── Price range ─────────────────────────────────────────────────────────
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // ── Bedrooms ────────────────────────────────────────────────────────────
    if (bedrooms && bedrooms !== 'Any') {
      const n = Number(bedrooms);
      if (n >= 4) {
        filter.bedrooms = { $gte: 4 };       // "4+" bucket
      } else {
        filter.bedrooms = n;
      }
    }

    // ── Bathrooms ───────────────────────────────────────────────────────────
    if (bathrooms && bathrooms !== 'Any') {
      filter.bathrooms = { $gte: Number(bathrooms) };
    }

    // ── Furnishing ──────────────────────────────────────────────────────────
    if (furnishing && furnishing !== 'Any') {
      filter.furnishing = furnishing;
    }

    // ── Status (Ready to Move / Under Construction…) ────────────────────────
    if (status && status !== 'Any') {
      filter.status = status;
    }

    // ── Featured only ────────────────────────────────────────────────────────
    if (featured === 'true') filter.featured = true;

    // ── Text search ──────────────────────────────────────────────────────────
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title:     { $regex: safe, $options: 'i' } },
        { location:  { $regex: safe, $options: 'i' } },
        { city:      { $regex: safe, $options: 'i' } },
        { developer: { $regex: safe, $options: 'i' } },
      ];
    }

    // ── Sort ─────────────────────────────────────────────────────────────────
    const sortMap = {
      newest:      { createdAt: -1 },
      'price-asc': { price:  1 },
      'price-desc':{ price: -1 },
      'area-desc': { area:  -1 },
    };
    const sortObj = sortMap[sort] || { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [total, properties] = await Promise.all([
      Property.countDocuments(filter),
      Property.find(filter)
        .select(LIST_FIELDS)
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      total,
      count: properties.length,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      properties,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getPropertyById = async (req, res) => {
  try {
    const property = await Property
      .findOne({ _id: req.params.id, isActive: true })
      .lean();
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    return res.status(200).json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/properties  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
export const createProperty = async (req, res) => {
  try {
    const { title, type, price, location, city } = req.body;
    if (!title || !type || !price || !location || !city) {
      return res.status(400).json({
        success: false,
        message: 'title, type, price, location and city are required',
      });
    }
    const property = await Property.create({
      ...req.body,
      addedBy: {
        role: req.user?.role || 'admin',
        name: req.user?.name || '',
      },
    });
    return res.status(201).json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/properties/:id  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
export const updateProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    return res.status(200).json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/properties/:id  (admin only — soft delete)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    return res.status(200).json({ success: true, message: 'Property removed from listings' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties/counts  — property counts by type and locality
// ─────────────────────────────────────────────────────────────────────────────
export const getPropertyCounts = async (req, res) => {
  try {
    const typeMap = {
      'Villa':      'Luxury Villas',
      'Apartment':  'Apartments',
      'Penthouse':  'Penthouses',
      'Commercial': 'Commercial',
      'Farm House': 'Farm Houses',
      'Plot':       'Plots',
    };

    const localities = [
      'Balewadi', 'Hadapsar', 'KP', 'NIBM Road', 'Viman Nagar', 'Kharadi',
      'Punewadi', 'Kothrud', 'Karve Nagar', 'Shewalewadi Road', 'Baner',
      'Pashan', 'Bawadhan', 'MG Road', 'JM Road', 'F.C. Road',
      'Hinjewadi Phase I, II', 'Ravet', 'Ganga Dham Chownk', 'Swargate',
      'Katraj', 'Prabhat Road',
    ];

    const [typeAgg, localityAgg] = await Promise.all([
      Property.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      Property.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            ...Object.fromEntries(
              localities.map((loc) => [
                `loc_${loc.replace(/[^a-zA-Z0-9]/g, '_')}`,
                {
                  $sum: {
                    $cond: [
                      { $regexMatch: { input: '$location', regex: loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' } },
                      1, 0,
                    ],
                  },
                },
              ])
            ),
          },
        },
      ]),
    ]);

    const typeCounts = {};
    typeAgg.forEach(({ _id, count }) => {
      const category = typeMap[_id] || _id;
      typeCounts[category] = (typeCounts[category] || 0) + count;
    });

    const localityCounts = {};
    const rawLocality = localityAgg[0] || {};
    localities.forEach((loc) => {
      const key = `loc_${loc.replace(/[^a-zA-Z0-9]/g, '_')}`;
      localityCounts[loc] = rawLocality[key] || 0;
    });

    return res.status(200).json({ success: true, typeCounts, localityCounts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
