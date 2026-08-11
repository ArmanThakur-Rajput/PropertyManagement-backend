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

// ── Public — cached ────────────────────────────────────────────────────────────

// Counts cached for 5 min (only changes on property create/edit)
router.get('/counts', cache(300), getPropertyCounts);

// Listing with full filter support — cached 60 s
router.get('/', cache(60), getAllProperties);

// Single property — cached 2 min
router.get('/:id', cache(120), getPropertyById);

// ── Admin write routes — bust cache on every write ─────────────────────────────

router.post(
  '/',
  ...adminOnly,
  (req, res, next) => { invalidateCache('/api/properties'); next(); },
  createProperty
);
router.put(
  '/:id',
  ...adminOnly,
  (req, res, next) => { invalidateCache('/api/properties'); next(); },
  updateProperty
);
router.delete(
  '/:id',
  ...adminOnly,
  (req, res, next) => { invalidateCache('/api/properties'); next(); },
  deleteProperty
);

export default router;
