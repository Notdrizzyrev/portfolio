import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import animeRoutes from './routes/animeRoutes.js';  // ADD THIS LINE
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS Configuration - Updated for Cloudflare deployment
app.use(cors({
  origin: function (origin, callback) {
    // List of allowed origins
    const allowedOrigins = [
      process.env.CORS_ORIGIN,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'https://animevault-backend.pages.dev',
      'https://anivault.is-pro.dev',
    ].filter(Boolean); // Remove undefined values

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later' }
});

app.use('/auth', authLimiter, authRoutes);
app.use('/api', animeRoutes);  // ADD THIS LINE
app.use('/watchlist', watchlistRoutes);
app.use('/progress', progressRoutes);
app.use('/settings', settingsRoutes);
app.use('/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.send('🎌 AniVault API running');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'AniVault Backend' });
});

app.use(notFound);
app.use(errorHandler);

export default app;