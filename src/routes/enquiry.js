import express from 'express';
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

// Public
router.post('/', createEnquiry);

// Staff (all internal roles)
router.get('/',           ...staffOnly,       getAllEnquiries);
router.get('/stats',      ...managementPlus,  getEnquiryStats);
router.get('/:id',        ...staffOnly,       getEnquiryById);
router.patch('/:id/status',  ...staffOnly,    updateEnquiryStatus);
router.post('/:id/followup', ...staffOnly,    addFollowUp);

// Lead control+
router.patch('/:id/assign',  ...leadControlPlus, assignEnquiry);

export default router;
