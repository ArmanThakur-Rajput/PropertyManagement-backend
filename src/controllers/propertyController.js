import Property from '../models/Property.js';

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
      page = 1, limit = 50,
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
        'Wagholi', 'Manjari', 'Lohgaon', 'Vishrantwadi', 'Khadki', 'Nanded City'
      ];
      if (localities.includes(city)) {
        filter.location = new RegExp(city, 'i');
      } else {
        filter.city = city;
      }
    }
    if (featured === 'true')          filter.featured = true;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      // Escape regex special characters to prevent ReDoS attacks
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(safeSearch, 'i');
      filter.$or = [{ title: re }, { location: re }, { city: re }, { developer: re }];
    }

    const sortMap = {
      newest:           { createdAt: -1 },
      'price-asc':      { price:  1 },
      'price-desc':     { price: -1 },
      'area-desc':      { area:  -1 },
    };
    const sortObj = sortMap[sort] || { createdAt: -1 };

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Property.countDocuments(filter);

    const properties = await Property
      .find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

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
// Public — single property detail
// ─────────────────────────────────────────────────────────────────────────────
export const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, isActive: true });
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
// Public — counts properties grouped by type and locality using aggregation
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
      'Katraj', 'Prabhat Road'
    ];

    // Single aggregation pipeline — far more efficient than fetching all docs and looping in JS
    const [typeAgg, localityAggs] = await Promise.all([
      // Group by property type
      Property.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      // Count each locality in parallel
      Promise.all(
        localities.map(async (loc) => ({
          locality: loc,
          count: await Property.countDocuments({
            isActive: true,
            location: new RegExp(loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
          }),
        }))
      ),
    ]);

    const typeCounts = {};
    typeAgg.forEach(({ _id, count }) => {
      const category = typeMap[_id] || _id;
      typeCounts[category] = (typeCounts[category] || 0) + count;
    });

    const localityCounts = {};
    localityAggs.forEach(({ locality, count }) => {
      localityCounts[locality] = count;
    });

    return res.status(200).json({ success: true, typeCounts, localityCounts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
