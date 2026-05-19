import express from 'express';

const router = express.Router();

// Placeholder auth routes
router.post('/login', (req, res) => {
  res.status(200).json({ success: true, message: 'Auth route - login' });
});

router.post('/register', (req, res) => {
  res.status(200).json({ success: true, message: 'Auth route - register' });
});

export default router;
