import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import connectDB from './config/db.js';

// ── Route imports ──────────────────────────────────────────────────────────────
import authRoutes          from './routes/auth.js';
import enquiryRoutes       from './routes/enquiry.js';
import propertyRoutes      from './routes/property.js';
import chatRoutes          from './routes/chat.js';
import blogRoutes          from './routes/blog.js';
import uploadRoutes        from './routes/upload.js';
import partnerRoutes       from './routes/partner.js';
import userListingRoutes   from './routes/userListings.js';
import testimonialsRoutes  from './routes/testimonials.js';   // ← NEW
import faqsRoutes          from './routes/faqs.js';           // ← NEW
import advisorsRoutes      from './routes/advisors.js';       // ← NEW
import settingsRoutes      from './routes/settings.js';       // ← NEW
import masterDataRoutes    from './routes/masterData.js';     // ← NEW

const app = express();

app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

connectDB();

// ── Compression ────────────────────────────────────────────────────────────────
app.use(compression({ threshold: 1024 }));

// ── Security Headers ───────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'"],
        styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:     ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc:      ["'self'", 'data:', 'https:', 'blob:'],
        mediaSrc:    ["'self'", 'https:', 'blob:'],
        connectSrc:  ["'self'", 'https://integrate.api.nvidia.com', 'https://oauth2.googleapis.com'],
        objectSrc:   ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ── Logging ────────────────────────────────────────────────────────────────────
app.use(morgan(isProd ? 'combined' : 'dev'));

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));

// ── Body & Cookie Parsers ──────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ── Base Route ─────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ success: true, message: 'API running 🚀' });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/enquiry',        enquiryRoutes);
app.use('/api/properties',     propertyRoutes);
app.use('/api/chat',           chatRoutes);
app.use('/api/blogs',          blogRoutes);
app.use('/api/upload',         uploadRoutes);
app.use('/api/partners',       partnerRoutes);
app.use('/api/user-listings',  userListingRoutes);
app.use('/api/testimonials',   testimonialsRoutes);   // ← NEW
app.use('/api/faqs',           faqsRoutes);           // ← NEW
app.use('/api/advisors',       advisorsRoutes);       // ← NEW
app.use('/api/settings',       settingsRoutes);       // ← NEW
app.use('/api/master-data',    masterDataRoutes);     // ← NEW

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'API running 🚀', env: process.env.NODE_ENV });
});

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  if (!isProd) console.error(err.stack);
  res.status(statusCode).json({
    success: false,
    message: isProd ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, () => {
  console.info(`🚀 Server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
