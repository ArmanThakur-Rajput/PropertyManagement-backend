import express from 'express';
import {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyCounts,
} from '../controllers/propertyController.js';
import { adminOnly } from '../middleware/auth.js';
import { cache, invalidateCache } from '../middleware/cache.js';

const router = express.Router();

// ── Public routes — cached ─────────────────────────────────────────────────────

// Cache counts for 5 minutes — only changes when properties are created/edited
router.get('/counts', cache(300), getPropertyCounts);

// Cache listing for 60 seconds
router.get('/', cache(60), getAllProperties);

// Single property — cache for 2 minutes
router.get('/:id', cache(120), getPropertyById);

// ── Admin write routes — bust cache on every write ─────────────────────────────

router.post('/',     ...adminOnly, (req, res, next) => { invalidateCache('/api/properties'); next(); }, createProperty);
router.put('/:id',   ...adminOnly, (req, res, next) => { invalidateCache('/api/properties'); next(); }, updateProperty);
router.delete('/:id',...adminOnly, (req, res, next) => { invalidateCache('/api/properties'); next(); }, deleteProperty);

export default router;
