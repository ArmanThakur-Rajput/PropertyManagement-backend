import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import connectDB from './config/db.js';
import authRoutes     from './routes/auth.js';
import enquiryRoutes  from './routes/enquiry.js';
import propertyRoutes from './routes/property.js';
import chatRoutes     from './routes/chat.js';
import blogRoutes     from './routes/blog.js';
import uploadRoutes   from './routes/upload.js';
import partnerRoutes  from './routes/partner.js';

const app = express();

// Trust proxy for rate limiting (Render/reverse proxy setups)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Connect to MongoDB
connectDB();

// ── Compression ────────────────────────────────────────────────────────────────
// Compress all responses with gzip — reduces payload by ~70%
app.use(compression());

// ── Security Headers ───────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'", "'unsafe-inline'"], // unsafe-inline required for theme init script
        styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
        fontSrc:        ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc:         ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc:     ["'self'", 'https://integrate.api.nvidia.com', 'https://oauth2.googleapis.com', 'https://www.googleapis.com'],
        mediaSrc:       ["'self'", 'https:', 'blob:'],
        objectSrc:      ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Required for map tiles and external media
  })
);

// ── Logging ────────────────────────────────────────────────────────────────────
// Use compact 'dev' format locally, structured 'combined' in production
app.use(morgan(isProd ? 'combined' : 'dev'));

// ── CORS — credentials: true so cookies are sent cross-origin ─────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Exact match
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Match CLIENT_URL from .env (handles custom prod domains)
    if (process.env.CLIENT_URL) {
      const clean = process.env.CLIENT_URL.replace(/\/$/, '');
      if (origin === clean) return callback(null, true);
    }

    // In dev only: allow any Vercel preview subdomain
    if (!isProd && origin.endsWith('.vercel.app')) return callback(null, true);

    return callback(null, false);
  },
  credentials: true, // Required for cookies to be sent & received
}));

// ── Body & Cookie Parsers ──────────────────────────────────────────────────────
// 1MB limit prevents request-body DoS attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Base Route ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ success: true, message: 'HyperRelestix API running 🚀' });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/enquiry',    enquiryRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/blogs',      blogRoutes);
app.use('/api/upload',     uploadRoutes);
app.use('/api/partners',   partnerRoutes);

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'HyperRelestix API running 🚀', env: process.env.NODE_ENV });
});

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global Error Handler ───────────────────────────────────────────────────────
// Never expose raw error stacks in production responses
app.use((err, req, res, next) => {
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
