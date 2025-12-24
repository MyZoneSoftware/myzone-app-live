import express from 'express';
const router = express.Router();

// TEMP sample data (replace later with MongoDB)
const items = [
  { code: 'RM', name: 'Multi-Family Residential', purpose: 'Medium/high density residential.' },
  { code: 'CN', name: 'Neighborhood Commercial', purpose: 'Neighborhood-scale retail and services.' }
];

router.get('/', (req, res) => {
  res.json({ items });
});

export default router;
