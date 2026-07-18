import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  signIn, getMe, signOut,
  getUserByPhone, getAllUsers,
  createStaff, updateUserRole, deleteUser,
  getWishlist, toggleWishlist,
  sendOtp, verifyOtp, socialSignIn, googleCallback,
} from '../controllers/authController.js';
import { protect, adminOnly, managementPlus } from '../middleware/auth.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  message: { success: false, message: 'Too many sign-in attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public
router.post('/signin',           authLimiter, signIn);
router.post('/otp/send',         authLimiter, sendOtp);
router.post('/otp/verify',       authLimiter, verifyOtp);
router.post('/social',           authLimiter, socialSignIn);
router.post('/google/callback',  authLimiter, googleCallback);
router.get('/me',                protect, getMe);
router.post('/signout',          signOut);

// Protected Wishlist
router.get('/wishlist',          protect, getWishlist);
router.post('/wishlist/toggle',   protect, toggleWishlist);

// Protected — management+ can view, admin can mutate
router.get('/users',             ...managementPlus, getAllUsers);
router.get('/user/:phone',       ...managementPlus, getUserByPhone);
router.post('/staff',            ...adminOnly,      createStaff);
router.patch('/users/:id/role',  ...adminOnly,      updateUserRole);
router.delete('/users/:id',     ...adminOnly,      deleteUser);

export default router;
