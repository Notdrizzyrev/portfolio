import express from 'express';

const router = express.Router();

// Placeholder notification routes
router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Notification route - get all' });
});

router.post('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Notification route - create' });
});

export default router;
