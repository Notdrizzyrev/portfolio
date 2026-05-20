import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import animeRoutes from './routes/animeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import errorMiddleware from './middleware/errorMiddleware.js';
import { syncAnimeToSupabase } from './services/supabaseSync.js';

const app = express();

// Middleware
app.use(cors({
  origin: [
    'https://anivault-3vt.pages.dev',
    'https://animevault-backend.pages.dev',
    'https://anivault.is-pro.dev',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection (disabled - using JSON)
connectDB();

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'AniVault Backend' });
});

// Routes
app.use('/api', animeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);

// Error Middleware
app.use(errorMiddleware);

// Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Sync anime to Supabase backup on startup
  syncAnimeToSupabase();
});

export default app;