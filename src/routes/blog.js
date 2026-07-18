import express from 'express';
import {
  getAllBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog
} from '../controllers/blogController.js';
import { protect, managementPlus } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllBlogs);
router.get('/:slug', getBlogBySlug);

// Admin/Management routes
router.post('/', ...managementPlus, createBlog);
router.put('/:id', ...managementPlus, updateBlog);
router.delete('/:id', ...managementPlus, deleteBlog);

export default router;
