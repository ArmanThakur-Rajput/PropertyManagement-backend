import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
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
      // Only update name if user doesn't already have one (never overwrite existing name from lead form)
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/send
// Now phone-based. target = 10-digit phone number.
// mode = 'login' | 'signup'
// In dev/demo mode: always returns dummy OTP 123456 in response (no SMS needed).
// ─────────────────────────────────────────────────────────────────────────────
export const sendOtp = async (req, res) => {
  try {
    const { target, mode } = req.body; // target = phone number

    if (!target) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const phone = target.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });
    }

    // Check database by phone
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

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    console.info(`🔑 [OTP SYSTEM] Phone: +91${phone} | Code: ${code}`);

    // Upsert OTP — store against phone number as target
    await Otp.findOneAndUpdate(
      { target: phone },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    // ── DEMO MODE: return OTP directly in response (no real SMS gateway needed)
    // Remove the `otp` field from response once you integrate a real SMS provider.
    return res.status(200).json({
      success: true,
      message: `OTP sent to +91${phone}`,
      otp: code, // ← DEMO ONLY: remove in production after SMS integration
    });
  } catch (error) {
    console.error('sendOtp error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/verify
// Now phone-based.
// Login:  { target: phone, code, mode: 'login' }
// Signup: { target: phone, code, mode: 'signup', name, email? }
// ─────────────────────────────────────────────────────────────────────────────
export const verifyOtp = async (req, res) => {
  try {
    const { target, code, mode, name, email } = req.body;

    if (!target || !code) {
      return res.status(400).json({ success: false, message: 'Phone number and OTP code are required' });
    }

    const phone = target.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }

    const otpRecord = await Otp.findOne({ target: phone, code });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Consume OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    let user;
    let isNew = false;

    if (mode === 'signup') {
      // Signup: name required, email optional
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Full name is required for signup' });
      }

      // Check if phone already registered
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'An account with this number already exists. Please login instead!' });
      }

      // Resolve email — use provided or generate a placeholder
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
      // Login flow: find by phone
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
    return res.status(500).json({ success: false, message: error.message || 'Something went wrong.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me — uses protect middleware; no duplicated JWT decoding here
// ─────────────────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    // req.user is populated by the protect middleware
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
// GET /api/auth/users  — admin: all users
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
// POST /api/auth/staff  — admin: create internal user (employee/lead_control etc)
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
      // Upgrade existing client to staff role
      existing.role = role;
      if (department !== undefined) existing.department = department;
      if (expertise !== undefined) existing.expertise = expertise;
      if (qualities !== undefined) existing.qualities = qualities;
      if (name)  existing.name  = name;
      existing.email = email.toLowerCase();
      await existing.save();
      return res.status(200).json({ success: true, message: 'User role updated', user: userPayload(existing) });
    }
    const user = await User.create({
      name,
      phone,
      email: email.toLowerCase(),
      role,
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
// PATCH /api/auth/users/:id/role  — admin: change user role
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

// ── User Wishlist Sync ────────────────────────────────────────────────────────
// POST /api/auth/wishlist/toggle
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

// GET /api/auth/wishlist
export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, wishlist: user.wishlist });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/social
export const socialSignIn = async (req, res) => {
  try {
    const { name, email, provider, phone: rawPhone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and Email are required for social login' });
    }

    // Normalise the real phone if provided (strip non-digits, take last 10)
    const realPhone = rawPhone ? rawPhone.replace(/\D/g, '').slice(-10) : null;
    const isRealPhone = realPhone && /^[6-9]\d{9}$/.test(realPhone);

    // Try to find existing user by phone first (phone OTP flow), then by email
    let user = isRealPhone
      ? await User.findOne({ $or: [{ phone: realPhone }, { email: email.toLowerCase() }] })
      : await User.findOne({ email: email.toLowerCase() });

    let isNew = false;

    if (!user) {
      // New user — use real phone if valid, else generate placeholder
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

      user = await User.create({
        name,
        email: email.toLowerCase(),
        phone,
        role: 'client',
      });
      isNew = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
      }
      // If user exists but has placeholder phone and we now have real phone — update it
      if (isRealPhone && user.phone !== realPhone && user.phone.startsWith('555')) {
        const conflict = await User.findOne({ phone: realPhone, _id: { $ne: user._id } });
        if (!conflict) user.phone = realPhone;
        await user.save();
      }
    }

    // Set cookie AND return token in response body (so frontend can persist to localStorage)
    const token = setTokenCookie(res, user._id);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? `Welcome, ${name}! Registered via ${provider}.` : 'Welcome back!',
      isNew,
      token,                    // ← frontend stores this in localStorage for session persistence
      user: userPayload(user),
    });
  } catch (error) {
    console.error('socialSignIn error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong during social login.' });
  }
};

// POST /api/auth/google/callback
export const googleCallback = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code is required' });
    }

    // Google client credentials MUST be set in environment variables — no hardcoded fallbacks
    const client_id     = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;
    const redirect_uri  = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/callback';

    if (!client_id || !client_secret) {
      return res.status(503).json({ success: false, message: 'Google OAuth is not configured on this server.' });
    }

    // 1. Exchange auth code for access token
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const exchangeResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await exchangeResponse.json();

    if (!exchangeResponse.ok || !tokens.access_token) {
      console.error('Google OAuth Token Exchange Error:', tokens);
      return res.status(400).json({ success: false, message: tokens.error_description || 'OAuth token exchange failed.' });
    }

    // 2. Fetch user profile from Google
    const profileUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
    const profileResponse = await fetch(profileUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const googleUser = await profileResponse.json();
    if (!profileResponse.ok || !googleUser.email) {
      console.error('Google Userinfo Fetch Error:', googleUser);
      return res.status(400).json({ success: false, message: 'Failed to retrieve Google user profile.' });
    }

    // 3. Register or sign in the user
    const email = googleUser.email.toLowerCase();
    const name = googleUser.name || googleUser.given_name || 'Google User';

    let user = await User.findOne({ email });
    let isNew = false;

    if (!user) {
      // Generate a unique collision-resistant placeholder phone (Google users have no phone)
      let phone;
      let isPhoneUnique = false;
      while (!isPhoneUnique) {
        const rand = parseInt(crypto.randomBytes(4).toString('hex'), 16) % 9000000;
        phone = `555${String(1000000 + rand).slice(0, 7)}`;
        const existingPhone = await User.findOne({ phone });
        if (!existingPhone) isPhoneUnique = true;
      }

      user = await User.create({
        name,
        email,
        phone,
        role: 'client',
      });
      isNew = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact support.' });
      }
    }

    // Set cookie
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
// DELETE /api/auth/users/:id  — admin: delete user account
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
// POST /api/auth/otp/send-phone
// ─────────────────────────────────────────────────────────────────────────────
export const sendPhoneOtp = async (req, res) => {
  try {
    const { phone, name, email } = req.body;

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit Indian mobile number required.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    console.info(`🔑 [PHONE OTP] Phone: +91${phone} | Code: ${code}`);

    await Otp.findOneAndUpdate(
      { target: phone },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    if (email && /\S+@\S+\.\S+/.test(email)) {
      await sendEmail({
        to: email,
        subject: `HyperRelestix Phone Verification: ${code}`,
        text: `Your phone verification code is ${code}. Valid for 5 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 25px; color: #071A2F; max-width: 500px; margin: 0 auto; border: 1px solid #E5C17D; border-radius: 16px; background-color: #FAF8F5;">
            <h2 style="font-size: 22px; font-weight: bold; margin: 0 0 4px 0; color: #071A2F;">Hyper<span style="color: #D4AF37;">Relestix</span></h2>
            <p style="font-size: 9px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 20px 0; color: #8C96A3;">Premium Real Estate</p>
            <hr style="border: 0; border-top: 1px solid #E5E9F0; margin-bottom: 20px;" />
            <h3 style="font-size: 15px;">Phone Verification Code</h3>
            <p style="font-size: 13px; color: #4A5568;">Use this code to verify your number <strong>+91 ${phone}</strong>. Expires in 5 minutes.</p>
            <div style="background-color: #071A2F; border-radius: 12px; text-align: center; font-size: 30px; font-weight: 800; letter-spacing: 6px; padding: 15px; margin: 20px 0; color: #E5C17D;">
              ${code}
            </div>
            <p style="font-size: 11px; color: #718096;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `
      });
    }

    return res.status(200).json({ success: true, message: 'OTP sent successfully!' });
  } catch (error) {
    console.error('sendPhoneOtp error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/verify-phone
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
        : `${phone}@phone.hyperrelestix.com`;

      user = await User.create({
        name: name || 'User',
        phone,
        email: resolvedEmail,
        role: 'client',
      });
      isNew = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Account deactivated. Please contact support.' });
      }
      // Only update name/email if user doesn't already have one (never overwrite from lead form)
      if (!user.name && name) user.name = name;
      if (!user.email && email && /\S+@\S+\.\S+/.test(email)) user.email = email.toLowerCase();
      await user.save();
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
    console.error('verifyPhoneOtp error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};
