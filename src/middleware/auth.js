import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ─────────────────────────────────────────────────────────────────────────────
// protect  — verifies JWT cookie, attaches req.user
// ─────────────────────────────────────────────────────────────────────────────
export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.hr_token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired session' });
    }

    const user = await User.findById(decoded.id).select('-__v');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// requireRole(...roles) — must come AFTER protect
// Usage: router.get('/path', protect, requireRole('admin'), handler)
// ─────────────────────────────────────────────────────────────────────────────
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}`,
    });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// Role shorthand middlewares
// ─────────────────────────────────────────────────────────────────────────────
export const adminOnly      = [protect, requireRole('admin')];
export const managementPlus = [protect, requireRole('admin', 'management')];
export const leadControlPlus= [protect, requireRole('admin', 'management')];
export const staffOnly      = [protect, requireRole('admin', 'management', 'agent')];
