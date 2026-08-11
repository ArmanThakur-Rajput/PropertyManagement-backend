import express from 'express';
import {
  uploadMiddleware,
  handleUpload,
  uploadManyMiddleware,
  handleUploadMany,
} from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Single file upload (image or video)
// Frontend sends: FormData with field "file"
router.post('/', protect, uploadMiddleware, handleUpload);

// Bulk upload (up to 10 files)
// Frontend sends: FormData with field "files" (multiple)
router.post('/many', protect, uploadManyMiddleware, handleUploadMany);

export default router;
