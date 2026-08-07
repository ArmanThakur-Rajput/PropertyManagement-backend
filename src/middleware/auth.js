import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ── Simple in-memory user cache ────────────────────────────────────────────────
// Avoids a DB lookup on EVERY authenticated request.
// Cache entries expire after 5 minutes. A user deactivation will take effect
// within 5 minutes, which is acceptable for this use case.
const userCache = new Map(); // userId → { user, expiresAt }
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedUser = (id) => {
  const hit = userCache.get(id);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) { userCache.delete(id); return null; }
  return hit.user;
};

const setCachedUser = (id, user) => {
  userCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL });
};

// Auto-clean cache every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [id, val] of userCache.entries()) {
    if (val.expiresAt <= now) userCache.delete(id);
  }
}, 10 * 60 * 1000);

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

    // ✅ Check cache first — avoids DB hit on every request
    let user = getCachedUser(decoded.id);
    if (!user) {
      user = await User.findById(decoded.id).select('-__v').lean();
      if (user) setCachedUser(decoded.id, user);
    }

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
export const adminOnly       = [protect, requireRole('admin')];
export const managementPlus  = [protect, requireRole('admin', 'management')];
export const leadControlPlus = [protect, requireRole('admin', 'management')];
export const staffOnly       = [protect, requireRole('admin', 'management', 'agent')];
