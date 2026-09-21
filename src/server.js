import * as Sentry from '@sentry/node';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import { globalApiLimiter } from './middleware/rateLimiter.js';
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
import testimonialsRoutes  from './routes/testimonials.js';
import faqsRoutes          from './routes/faqs.js';
import advisorsRoutes      from './routes/advisors.js';
import settingsRoutes      from './routes/settings.js';
import masterDataRoutes    from './routes/masterData.js';
import notifyErrorRouter from './routes/notifyError.js';

const app = express();

// ==================== LIGHTWEIGHT API METRICS ====================

const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  durations: [],
};

app.use((req, res, next) => {
  // Metrics endpoint ko khud metrics mein count mat karo
  if (req.path === '/api/metrics') {
    return next();
  }

  const start = process.hrtime.bigint();

  metrics.totalRequests++;

  res.on('finish', () => {
    const duration =
      Number(process.hrtime.bigint() - start) / 1_000_000;

    if (res.statusCode >= 500) {
      metrics.totalErrors++;
    }

    metrics.durations.push(duration);

    // Last 5000 requests hi memory mein rakho
    if (metrics.durations.length > 5000) {
      metrics.durations.shift();
    }
  });

  next();
});

app.get('/api/metrics', (req, res) => {
  const durations = [...metrics.durations].sort((a, b) => a - b);

  const percentile = (p) => {
    if (!durations.length) return 0;

    const index = Math.ceil((p / 100) * durations.length) - 1;

    return Math.round(durations[Math.max(0, index)]);
  };

  const avg = durations.length
    ? durations.reduce((sum, value) => sum + value, 0) /
      durations.length
    : 0;

  res.json({
    success: true,

    requests: {
      total: metrics.totalRequests,
      errors5xx: metrics.totalErrors,
    },

    responseTimeMs: {
      average: Math.round(avg),
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      max: durations.length
        ? Math.round(durations[durations.length - 1])
        : 0,
    },

    sampleSize: durations.length,

    uptimeSeconds: Math.round(process.uptime()),

    memoryMB: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      ),
    },

    timestamp: new Date().toISOString(),
  });
});





app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
});

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
        scriptSrc:   ["'self'"],
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
//app.use(morgan(isProd ? 'combined' : 'dev'));

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://kinpropertymanagement.com',
    'https://www.kinpropertymanagement.com',
  ],
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
// Light global protection; sensitive/expensive endpoints add stricter route limits.
app.use('/api', globalApiLimiter);

app.use('/api/auth',           authRoutes);
app.use('/api/enquiry',        enquiryRoutes);
app.use('/api/properties',     propertyRoutes);
app.use('/api/chat',           chatRoutes);
app.use('/api/blogs',          blogRoutes);
app.use('/api/upload',         uploadRoutes);
app.use('/api/partners',       partnerRoutes);
app.use('/api/user-listings',  userListingRoutes);
app.use('/api/testimonials',   testimonialsRoutes);
app.use('/api/faqs',           faqsRoutes);
app.use('/api/advisors',       advisorsRoutes);
app.use('/api/settings',       settingsRoutes);
app.use('/api/master-data',    masterDataRoutes);
app.use('/api', notifyErrorRouter);

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'ok' });
});

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Sentry Error Handler ───────────────────────────────────────────────────────
app.use(Sentry.expressErrorHandler());

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
