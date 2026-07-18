import express from 'express';
import { uploadMiddleware, handleUpload } from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Allow any authenticated user to upload media
router.post('/', protect, uploadMiddleware, handleUpload);

export default router;
