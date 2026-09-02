import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Enquiry from '../models/Enquiry.js';
import Property from '../models/Property.js';
import { sendEmail } from '../utils/mailer.js';

// ── Helper: sign a JWT and set it as httpOnly cookie ──────────────────────────
const setTokenCookie = (res, userId) => {
  const token = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );

  res.cookie('hr_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return token;
};

// ── Shared user shape returned in every response ──────────────────────────────
const userPayload = (user) => ({
  id:         user._id,
  name:       user.name,
  phone:      user.phone,
  email:      user.email,
  role:       user.role,
  department: user.department,
  expertise:  user.expertise || '',
  qualities:  user.qualities || '',
  isActive:   user.isActive,
  createdAt:  user.createdAt,
});

// ── APITxt OTP helpers ────────────────────────────────────────────────────────
// APITxt: tumhe khud OTP generate karna hai, unhe bhejte ho, verify bhi khud karte ho

// Step 1: OTP generate + send via APITxt
const sendApitxtOtp = async (phone) => {
  const authkey = process.env.APITXT_KEY;
  if (!authkey) throw new Error('APITXT_KEY not configured');

  // 6-digit OTP generate karo
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  const res = await fetch('https://apitxt.com/api/sendOTP', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      authkey,
      mobile: `91${phone}`,
      otp,
    }),
  });

  const data = await res.json();
  console.log('APITxt sendOTP response:', data);

  if (data.status !== 'success') {
    throw new Error(data.message || 'APITxt OTP sending failed');
  }

  return { otp, requestId: data.data?.request_id };
};

// Step 2: Verify OTP — MongoDB mein stored OTP se match karo
// (APITxt khud verify nahi karta, hum compare karte hain)
// OTP store in-memory (ya tum Otp model use kar sakte ho)
const otpStore = new Map(); // phone → { otp, expiresAt }

const storeOtp = (phone, otp) => {
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
};

const verifyStoredOtp = (phone, otp) => {
  const entry = otpStore.get(phone);
  if (!entry) throw new Error('OTP not found. Please request a new one.');
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    throw new Error('OTP has expired. Please request a new one.');
  }
  if (entry.otp !== otp) throw new Error('Invalid OTP. Please check and try again.');
  otpStore.delete(phone); // use ho gaya — delete karo
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/signin
// ─────────────────────────────────────────────────────────────────────────────
export const signIn = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    // Email-only sign in (Staff/Admin Portal)
    if (email && !phone && !name) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Staff account not found for this email.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact support.' });
      }
      setTokenCookie(res, user._id);
      return res.status(200).json({
        success: true,
        message: 'Welcome back!',
        isNew: false,
        user: userPayload(user),
      });
    }

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });
    }

    let user = await User.findOne({ phone });
    let isNew = false;

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact support.' });
      }
      if (!user.name && name) user.name = name;
      if (email && !user.email) user.email = email;
      await user.save();
    } else {
      user = await User.create({ name, phone, email: email || '', role: 'client' });
      isNew = true;
    }

    setTokenCookie(res, user._id);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Account created successfully!' : 'Welcome back!',
      isNew,
      user: userPayload(user),
    });
  } catch (error) {
    console.error('SignIn error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// ── Rate Limit Store (in-memory) ─────────────────────────────────────────────
// Per phone: max 3 OTP requests per 10 minutes
const otpRateLimit = new Map(); // phone → { count, firstRequestAt }

const checkRateLimit = (phone) => {
  const now      = Date.now();
  const window   = 10 * 60 * 1000; // 10 minutes
  const maxRetry = 3;

  const entry = otpRateLimit.get(phone);

  if (!entry || now - entry.firstRequestAt > window) {
    otpRateLimit.set(phone, { count: 1, firstRequestAt: now });
    return null; // allowed
  }

  if (entry.count >= maxRetry) {
    const retryAfter = Math.ceil((window - (now - entry.firstRequestAt)) / 1000);
    const mins = Math.ceil(retryAfter / 60);
    const msg  = mins > 1 ? `${mins} minutes` : `${retryAfter} seconds`;
    return `Too many OTP requests. Please try again in ${msg}.`;
  }

  entry.count += 1;
  return null; // allowed
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/send
// Message Central se OTP bhejta hai
// ─────────────────────────────────────────────────────────────────────────────
export const sendOtp = async (req, res) => {
  try {
    const { target, mode } = req.body;

    if (!target) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const phone = target.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });
    }

    // User existence check based on mode
    const user = await User.findOne({ phone });

    if (mode === 'login') {
      if (!user) {
        return res.status(404).json({ success: false, message: 'No account registered with this number. Please sign up!' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact support.' });
      }
    } else if (mode === 'signup') {
      if (user) {
        return res.status(400).json({ success: false, message: 'An account with this number already exists. Please login instead!' });
      }
    }

    // Rate limit check
    const rateLimitError = checkRateLimit(phone);
    if (rateLimitError) {
      return res.status(429).json({ success: false, message: rateLimitError });
    }

    // APITxt se OTP bhejo
    const { otp } = await sendApitxtOtp(phone);

    // OTP in-memory store karo (5 min expiry)
    storeOtp(phone, otp);

    return res.status(200).json({
      success: true,
      message: `OTP sent to +91${phone}`,
    });
  } catch (error) {
    console.error('sendOtp error:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'OTP sending failed. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/verify
// MongoDB se OTP verify karo, user create/login karo
// ─────────────────────────────────────────────────────────────────────────────
export const verifyOtp = async (req, res) => {
  try {
    const { phone: rawPhone, otp, mode, name, email } = req.body;

    if (!rawPhone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const phone = rawPhone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid Indian mobile number' });
    }

    // In-memory OTP verify karo
    verifyStoredOtp(phone, otp);

    let user;
    let isNew = false;

    if (mode === 'signup') {
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Full name is required for signup' });
      }

      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'An account with this number already exists. Please login instead!' });
      }

      const resolvedEmail = email && /\S+@\S+\.\S+/.test(email)
        ? email.toLowerCase()
        : `${phone}@phone.kinproperty.com`;

      user = await User.create({
        name: name.trim(),
        phone,
        email: resolvedEmail,
        role: 'client',
      });
      isNew = true;
    } else {
      // Login flow
      user = await User.findOne({ phone });
      if (!user) {
        return res.status(404).json({ success: false, message: 'No account found. Please sign up first!' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Account deactivated. Please contact support.' });
      }
    }

    const token = setTokenCookie(res, user._id);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Account created successfully!' : 'Welcome back!',
      isNew,
      token,
      user: userPayload(user),
    });
  } catch (error) {
    console.error('verifyOtp error:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'OTP verification failed.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    return res.status(200).json({ success: true, user: userPayload(req.user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/signout
// ─────────────────────────────────────────────────────────────────────────────
export const signOut = async (req, res) => {
  res.clearCookie('hr_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  return res.status(200).json({ success: true, message: 'Signed out successfully' });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/user/:phone
// ─────────────────────────────────────────────────────────────────────────────
export const getUserByPhone = async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phone });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, user: userPayload(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/users
// ─────────────────────────────────────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    const users = await User.find(filter).sort({ createdAt: -1 });

    const mapped = await Promise.all(users.map(async (u) => {
      const payload = userPayload(u);
      if (u.role !== 'client') {
        const activeLeadsCount = await Enquiry.countDocuments({
          assignedTo: u._id,
          status: { $nin: ['converted', 'lost'] }
        });
        payload.activeLeads = activeLeadsCount;

        const propertiesCount = await Property.countDocuments({
          'agent.id': String(u._id)
        });
        payload.propertiesCount = propertiesCount;
      } else {
        payload.activeLeads = 0;
        payload.propertiesCount = 0;
      }
      return payload;
    }));

    return res.status(200).json({ success: true, count: users.length, users: mapped });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/staff
// ─────────────────────────────────────────────────────────────────────────────
export const createStaff = async (req, res) => {
  try {
    const { name, phone, email, role, department, expertise, qualities } = req.body;
    if (!name || !phone || !email || !role) {
      return res.status(400).json({ success: false, message: 'name, phone, email and role are required' });
    }
    const allowed = ['agent', 'management', 'admin'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    const existing = await User.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
    if (existing) {
      existing.role = role;
      if (department !== undefined) existing.department = department;
      if (expertise !== undefined) existing.expertise = expertise;
      if (qualities !== undefined) existing.qualities = qualities;
      if (name) existing.name = name;
      existing.email = email.toLowerCase();
      await existing.save();
      return res.status(200).json({ success: true, message: 'User role updated', user: userPayload(existing) });
    }
    const user = await User.create({
      name, phone, email: email.toLowerCase(), role,
      department: department || '',
      expertise: expertise || '',
      qualities: qualities || ''
    });
    return res.status(201).json({ success: true, message: 'Staff member created', user: userPayload(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/users/:id/role
// ─────────────────────────────────────────────────────────────────────────────
export const updateUserRole = async (req, res) => {
  try {
    const { role, department, expertise, qualities, isActive, name, phone, email } = req.body;
    const update = {};
    if (role !== undefined) {
      const allowed = ['client', 'agent', 'management', 'admin'];
      if (!allowed.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      update.role = role;
    }
    if (department !== undefined) update.department = department;
    if (expertise  !== undefined) update.expertise  = expertise;
    if (qualities  !== undefined) update.qualities  = qualities;
    if (isActive   !== undefined) update.isActive   = isActive;
    if (name       !== undefined) update.name       = name;
    if (phone      !== undefined) update.phone      = phone;
    if (email      !== undefined) update.email      = email ? email.toLowerCase() : '';

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, user: userPayload(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── User Wishlist ─────────────────────────────────────────────────────────────
export const toggleWishlist = async (req, res) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'Property ID is required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const index = user.wishlist.indexOf(propertyId);
    if (index > -1) {
      user.wishlist.splice(index, 1);
    } else {
      user.wishlist.push(propertyId);
    }
    await user.save();
    const populated = await User.findById(req.user.id).populate('wishlist');
    return res.status(200).json({ success: true, wishlist: populated.wishlist });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, wishlist: user.wishlist });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Social Sign In ────────────────────────────────────────────────────────────
export const socialSignIn = async (req, res) => {
  try {
    const { name, email, provider, phone: rawPhone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and Email are required for social login' });
    }

    const realPhone = rawPhone ? rawPhone.replace(/\D/g, '').slice(-10) : null;
    const isRealPhone = realPhone && /^[6-9]\d{9}$/.test(realPhone);

    let user = isRealPhone
      ? await User.findOne({ $or: [{ phone: realPhone }, { email: email.toLowerCase() }] })
      : await User.findOne({ email: email.toLowerCase() });

    let isNew = false;

    if (!user) {
      let phone = realPhone && isRealPhone ? realPhone : null;
      if (!phone) {
        let isPhoneUnique = false;
        while (!isPhoneUnique) {
          const rand = parseInt(crypto.randomBytes(4).toString('hex'), 16) % 9000000;
          phone = `555${String(1000000 + rand).slice(0, 7)}`;
          const existingPhone = await User.findOne({ phone });
          if (!existingPhone) isPhoneUnique = true;
        }
      }
      user = await User.create({ name, email: email.toLowerCase(), phone, role: 'client' });
      isNew = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
      }
      if (isRealPhone && user.phone !== realPhone && user.phone.startsWith('555')) {
        const conflict = await User.findOne({ phone: realPhone, _id: { $ne: user._id } });
        if (!conflict) user.phone = realPhone;
        await user.save();
      }
    }

    const token = setTokenCookie(res, user._id);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? `Welcome, ${name}! Registered via ${provider}.` : 'Welcome back!',
      isNew, token,
      user: userPayload(user),
    });
  } catch (error) {
    console.error('socialSignIn error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong during social login.' });
  }
};

// ── Google Callback ───────────────────────────────────────────────────────────
export const googleCallback = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code is required' });
    }

    const client_id     = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;
    const redirect_uri  = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/callback';

    if (!client_id || !client_secret) {
      return res.status(503).json({ success: false, message: 'Google OAuth is not configured on this server.' });
    }

    const exchangeResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, client_id, client_secret, redirect_uri, grant_type: 'authorization_code' }),
    });

    const tokens = await exchangeResponse.json();

    if (!exchangeResponse.ok || !tokens.access_token) {
      return res.status(400).json({ success: false, message: tokens.error_description || 'OAuth token exchange failed.' });
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const googleUser = await profileResponse.json();
    if (!profileResponse.ok || !googleUser.email) {
      return res.status(400).json({ success: false, message: 'Failed to retrieve Google user profile.' });
    }

    const email = googleUser.email.toLowerCase();
    const name = googleUser.name || googleUser.given_name || 'Google User';

    let user = await User.findOne({ email });
    let isNew = false;

    if (!user) {
      let phone;
      let isPhoneUnique = false;
      while (!isPhoneUnique) {
        const rand = parseInt(crypto.randomBytes(4).toString('hex'), 16) % 9000000;
        phone = `555${String(1000000 + rand).slice(0, 7)}`;
        const existingPhone = await User.findOne({ phone });
        if (!existingPhone) isPhoneUnique = true;
      }
      user = await User.create({ name, email, phone, role: 'client' });
      isNew = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact support.' });
      }
    }

    setTokenCookie(res, user._id);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Successfully registered with Google!' : 'Welcome back!',
      isNew,
      user: userPayload(user),
    });
  } catch (error) {
    console.error('googleCallback error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong during Google login.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/users/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/send-phone  (email OTP fallback — unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const sendPhoneOtp = async (req, res) => {
  try {
    const { phone, name, email } = req.body;

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit Indian mobile number required.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { target: phone },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    if (email && /\S+@\S+\.\S+/.test(email)) {
      await sendEmail({
        to: email,
        subject: `Phone Verification Code: ${code}`,
        text: `Your phone verification code is ${code}. Valid for 5 minutes.`,
        html: `<div style="font-family:Arial,sans-serif;padding:25px;max-width:500px;">
          <h2>Phone Verification Code</h2>
          <p>Use this code to verify <strong>+91 ${phone}</strong>. Expires in 5 minutes.</p>
          <div style="background:#071A2F;border-radius:12px;text-align:center;font-size:30px;font-weight:800;letter-spacing:6px;padding:15px;margin:20px 0;color:#E5C17D;">${code}</div>
        </div>`
      });
    }

    return res.status(200).json({ success: true, message: 'OTP sent successfully!' });
  } catch (error) {
    console.error('sendPhoneOtp error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/verify-phone  (email OTP fallback — unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const verifyPhoneOtp = async (req, res) => {
  try {
    const { phone, code, name, email } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required.' });
    }

    const otpRecord = await Otp.findOne({ target: phone, code });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    let user = await User.findOne({ phone });
    let isNew = false;

    if (!user) {
      const resolvedEmail = email && /\S+@\S+\.\S+/.test(email)
        ? email.toLowerCase()
        : `${phone}@phone.kinproperty.com`;

      user = await User.create({
        name: name || 'User', phone, email: resolvedEmail, role: 'client',
      });
      isNew = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Account deactivated. Please contact support.' });
      }
      if (!user.name && name) user.name = name;
      if (!user.email && email && /\S+@\S+\.\S+/.test(email)) user.email = email.toLowerCase();
      await user.save();
    }

    const token = setTokenCookie(res, user._id);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Account created successfully!' : 'Welcome back!',
      isNew, token,
      user: userPayload(user),
    });
  } catch (error) {
    console.error('verifyPhoneOtp error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};
