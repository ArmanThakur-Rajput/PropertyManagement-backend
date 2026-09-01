import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  createEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
  assignEnquiry,
  addFollowUp,
  getEnquiryStats,
} from '../controllers/enquiryController.js';
import { staffOnly, leadControlPlus, managementPlus } from '../middleware/auth.js';

const router = express.Router();

// Prevent bots from flooding enquiry submissions (5 per IP per 10 min)
const enquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many enquiries submitted. Please try again after 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public
router.post('/', enquiryLimiter, createEnquiry);

// Staff (all internal roles)
router.get('/',           ...staffOnly,       getAllEnquiries);
router.get('/stats',      ...managementPlus,  getEnquiryStats);
router.get('/:id',        ...staffOnly,       getEnquiryById);
router.patch('/:id/status',  ...staffOnly,    updateEnquiryStatus);
router.post('/:id/followup', ...staffOnly,    addFollowUp);

// Lead control+
router.patch('/:id/assign',  ...leadControlPlus, assignEnquiry);

export default router;
