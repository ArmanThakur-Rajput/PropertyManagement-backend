import express from 'express';
import {
  signInLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
} from '../middleware/rateLimiter.js';
import {
  signIn, getMe, signOut,
  getUserByPhone, getAllUsers,
  createStaff, updateUserRole, updateMyListingType, deleteUser,
  getWishlist, toggleWishlist,
  sendOtp, verifyOtp, socialSignIn, googleCallback,
  sendPhoneOtp, verifyPhoneOtp,
} from '../controllers/authController.js';
import { protect, adminOnly, managementPlus } from '../middleware/auth.js';

const router = express.Router();

;

// Public
router.post('/signin',           signInLimiter, signIn);
router.post('/otp/send',         otpSendLimiter, sendOtp);
router.post('/otp/verify',       otpVerifyLimiter, verifyOtp);
router.post('/otp/send-phone',   otpSendLimiter, sendPhoneOtp);
router.post('/otp/verify-phone', otpVerifyLimiter, verifyPhoneOtp);
// Social/OAuth callbacks are also protected by the global API limiter.
router.post('/social',           signInLimiter, socialSignIn);
router.post('/google/callback',  signInLimiter, googleCallback);
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
router.patch('/me/listing-type', protect, updateMyListingType);
router.delete('/users/:id',     ...adminOnly,      deleteUser);

export default router;
