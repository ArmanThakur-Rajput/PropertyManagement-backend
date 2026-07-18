import Enquiry from '../models/Enquiry.js';
import Property from '../models/Property.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/enquiry  — public: all form types
// ─────────────────────────────────────────────────────────────────────────────
export const createEnquiry = async (req, res) => {
  try {
    const { type, name, phone, email, propertyId } = req.body;

    if (!type) return res.status(400).json({ success: false, message: 'Enquiry type is required' });
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });

    const cleanPhone = phone.replace(/\s/g, '');
    const indianPhone = /^[6-9]\d{9}$/.test(cleanPhone);
    const intlPhone = /^\+\d{7,15}$/.test(cleanPhone);
    if (!indianPhone && !intlPhone) {
      return res.status(400).json({ success: false, message: 'Enter a valid phone number' });
    }

    if (type === 'newsletter') {
      if (!email) return res.status(400).json({ success: false, message: 'Email is required for newsletter' });
      const existing = await Enquiry.findOne({ type: 'newsletter', email: email.toLowerCase() });
      if (existing) return res.status(200).json({ success: true, message: 'Already subscribed!' });
    }

    const payload = {
      type,
      name,
      phone,
      email: email || '',
      status: 'new',
      assignedTo: null,
      assignedToName: '',
      assignedAt: null,
      followUps: [],
    };

    if (propertyId) {
      try {
        const prop = await Property.findById(propertyId);
        if (prop) {
          payload.propertyId = prop._id;
          payload.propertyTitle = prop.title;
          if (prop.agent && prop.agent.id) {
            payload.assignedTo = prop.agent.id;
            payload.assignedToName = prop.agent.name;
            payload.assignedAt = new Date();
          }
        }
      } catch (err) {
        console.error("Auto-assignment failed:", err);
      }
    }

    if (type === 'contact') {
      payload.subject = req.body.subject || '';
      payload.message = req.body.message || '';
    } else if (type === 'buy') {
      payload.propertyType = req.body.propertyType || '';
      payload.locality = req.body.locality || '';
      payload.budget = req.body.budget || '';
      payload.timing = req.body.timing || '';
      payload.isNRI = req.body.isNRI || false;
    } else if (type === 'sell') {
      payload.propertyLocality = req.body.propertyLocality || '';
      payload.propertyArea = req.body.propertyArea || '';
      payload.bedrooms = req.body.bedrooms || '';
      payload.askingPrice = req.body.askingPrice || '';
      payload.furnishing = req.body.furnishing || '';
      payload.images = req.body.images || [];
    } else if (type === 'lease') {
      payload.leasePurpose = req.body.leasePurpose || '';
      payload.rentRange = req.body.rentRange || '';
      payload.duration = req.body.duration || '';
    } else if (type === 'management') {
      payload.managementTier = req.body.managementTier || '';
      payload.numberOfProperties = req.body.numberOfProperties || '';
    }

    const enquiry = await Enquiry.create(payload);

    const messages = {
      contact: "Message received! We'll respond within 2 hours.",
      buy: 'Requirement submitted! Your advisor will contact you within 24 hours.',
      sell: 'Listing request received! Our team will assess your property within 48 hours.',
      lease: 'Lease enquiry submitted! Our rental desk will reach out soon.',
      management: "Management enquiry received! We'll schedule a property assessment.",
      newsletter: "Subscribed successfully! You'll receive our next NRI property update.",
    };

    return res.status(201).json({
      success: true,
      message: messages[type] || 'Enquiry submitted successfully!',
      id: enquiry._id,
    });
  } catch (error) {
    console.error('Enquiry creation error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/enquiry  — staff: list with filters
// ─────────────────────────────────────────────────────────────────────────────
export const getAllEnquiries = async (req, res) => {
  try {
    const { type, status, assignedTo, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Employees and agents can only see their own assigned leads
    if (req.user.role === 'employee' || req.user.role === 'agent') {
      filter.assignedTo = req.user._id;
    }

    const total = await Enquiry.countDocuments(filter);
    const enquiries = await Enquiry
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('assignedTo', 'name phone role');

    return res.status(200).json({ success: true, total, count: enquiries.length, enquiries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/enquiry/:id  — staff: single enquiry detail + history
// ─────────────────────────────────────────────────────────────────────────────
export const getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id)
      .populate('assignedTo', 'name phone role department');
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    // Employees and agents can only see their own
    if ((req.user.role === 'employee' || req.user.role === 'agent') &&
      String(enquiry.assignedTo?._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/enquiry/:id/status  — staff: update lead status
// ─────────────────────────────────────────────────────────────────────────────
export const updateEnquiryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['new', 'contacted', 'visited', 'qualified', 'converted', 'lost'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    // Employees and agents can only update their own leads
    if ((req.user.role === 'employee' || req.user.role === 'agent') &&
      String(enquiry.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    enquiry.status = status;
    await enquiry.save();

    return res.status(200).json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/enquiry/:id/assign  — lead_control+: assign to employee
// ─────────────────────────────────────────────────────────────────────────────
export const assignEnquiry = async (req, res) => {
  try {
    const { employeeId, employeeName } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'employeeId is required' });
    }

    const enquiryObj = await Enquiry.findById(req.params.id);
    if (!enquiryObj) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    const statusUpdate = enquiryObj.status === 'new' ? 'contacted' : enquiryObj.status;

    enquiryObj.assignedTo = employeeId;
    enquiryObj.assignedToName = employeeName || '';
    enquiryObj.assignedAt = new Date();
    enquiryObj.status = statusUpdate;

    await enquiryObj.save();

    const populated = await Enquiry.findById(enquiryObj._id).populate('assignedTo', 'name phone role');
    return res.status(200).json({ success: true, enquiry: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/enquiry/:id/followup  — staff: add follow-up note
// ─────────────────────────────────────────────────────────────────────────────
export const addFollowUp = async (req, res) => {
  try {
    const { note } = req.body;
    if (!note?.trim()) {
      return res.status(400).json({ success: false, message: 'Note is required' });
    }

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    if ((req.user.role === 'employee' || req.user.role === 'agent') &&
      String(enquiry.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    enquiry.followUps.push({
      note: note.trim(),
      addedBy: req.user._id,
      addedByName: req.user.name,
    });
    await enquiry.save();

    return res.status(200).json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/enquiry/stats  — management+: dashboard numbers
// ─────────────────────────────────────────────────────────────────────────────
export const getEnquiryStats = async (req, res) => {
  try {
    const [total, byStatus, byType, recentWeek] = await Promise.all([
      Enquiry.countDocuments(),
      Enquiry.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Enquiry.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      Enquiry.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: { total, byStatus, byType, recentWeek },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
