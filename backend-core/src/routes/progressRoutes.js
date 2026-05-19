import express from 'express';

const router = express.Router();

// Placeholder progress routes
router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Progress route - get all' });
});

router.post('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Progress route - update' });
});

export default router;

