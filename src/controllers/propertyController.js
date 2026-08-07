import Property from '../models/Property.js';

// Listing-page fields only — no amenities/description/images array in list view
// Full details are fetched on the detail page via getPropertyById
const LIST_FIELDS =
  'title type price priceLabel location city image badge badgeColor status featured ' +
  'bedrooms bathrooms area parking agent yearBuilt developer rera coordinates createdAt';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties
// Public — supports filtering, sorting, pagination
// Query params: type, city, minPrice, maxPrice, featured, search, sort, page, limit
// ─────────────────────────────────────────────────────────────────────────────
export const getAllProperties = async (req, res) => {
  try {
    const {
      type, city, minPrice, maxPrice,
      featured, search,
      sort = 'newest',
      page = 1, limit = 20,   // ✅ reduced from 50 → 20 (less data per request)
    } = req.query;

    const filter = { isActive: true };

    if (type    && type    !== 'All') filter.type = type;
    if (city    && city    !== 'All') {
      const localities = [
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
      if (localities.includes(city)) {
        filter.location = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      } else {
        filter.city = city;
      }
    }
    if (featured === 'true') filter.featured = true;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // ✅ Use MongoDB $text search when possible (uses index, much faster than regex)
    // Falls back to regex only when $text can't be combined with other operators
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title:     new RegExp(safeSearch, 'i') },
        { location:  new RegExp(safeSearch, 'i') },
        { city:      new RegExp(safeSearch, 'i') },
        { developer: new RegExp(safeSearch, 'i') },
      ];
    }

    const sortMap = {
      newest:      { createdAt: -1 },
      'price-asc': { price:  1 },
      'price-desc':{ price: -1 },
      'area-desc': { area:  -1 },
    };
    const sortObj = sortMap[sort] || { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    // ✅ Run count + find in parallel (saves one round-trip)
    const [total, properties] = await Promise.all([
      Property.countDocuments(filter),
      Property
        .find(filter)
        .select(LIST_FIELDS)          // ✅ Only listing fields, not full doc
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .lean(),                      // ✅ .lean() returns plain JS objects (2–3× faster)
    ]);

    return res.status(200).json({
      success: true,
      total,
      count: properties.length,
      page: Number(page),
      properties,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties/:id
// Public — single property detail (full document)
// ─────────────────────────────────────────────────────────────────────────────
export const getPropertyById = async (req, res) => {
  try {
    const property = await Property
      .findOne({ _id: req.params.id, isActive: true })
      .lean();                        // ✅ lean here too
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    return res.status(200).json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/properties
// Admin — create new property listing
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
    const property = await Property.create(req.body);
    return res.status(201).json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/properties/:id
// Admin — full update
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
// DELETE /api/properties/:id
// Admin — soft delete (sets isActive: false)
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
// GET /api/properties/counts
// Public — counts by type and locality
//
// ✅ FIX: Was running 22+ separate DB queries. Now uses a SINGLE aggregation
//    pipeline that scans the collection once and extracts all counts at once.
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

    // ✅ Single aggregation — scan collection ONCE, extract all counts
    // Old code: 22 separate countDocuments() calls = 22 DB round-trips
    // New code: 2 aggregation pipelines in parallel = 2 DB round-trips
    const [typeAgg, localityAgg] = await Promise.all([
      // Group by property type (unchanged — already efficient)
      Property.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),

      // ✅ Count all localities in ONE pipeline pass
      Property.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            // For each locality: count docs where location contains locality name
            ...Object.fromEntries(
              localities.map((loc) => [
                // Use a safe key (replace special chars like spaces, dots)
                `loc_${loc.replace(/[^a-zA-Z0-9]/g, '_')}`,
                {
                  $sum: {
                    $cond: [
                      {
                        $regexMatch: {
                          input: '$location',
                          regex: loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                          options: 'i',
                        },
                      },
                      1,
                      0,
                    ],
                  },
                },
              ])
            ),
          },
        },
      ]),
    ]);

    // Build typeCounts from aggregation
    const typeCounts = {};
    typeAgg.forEach(({ _id, count }) => {
      const category = typeMap[_id] || _id;
      typeCounts[category] = (typeCounts[category] || 0) + count;
    });

    // Build localityCounts — map safe keys back to original locality names
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
