import express from 'express';

const router = express.Router();

// Placeholder watchlist routes
router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Watchlist route - get all' });
});

router.post('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Watchlist route - add' });
});

export default router;
