import express from 'express';
import {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyCounts,
} from '../controllers/propertyController.js';
import { adminOnly, managementPlus } from '../middleware/auth.js';

const router = express.Router();

// Public
router.get('/',       getAllProperties);
router.get('/counts', getPropertyCounts);
router.get('/:id',    getPropertyById);

// Admin / management protected
router.post('/',       ...managementPlus, createProperty);
router.put('/:id',     ...managementPlus, updateProperty);
router.delete('/:id',  ...adminOnly,      deleteProperty);

export default router;
