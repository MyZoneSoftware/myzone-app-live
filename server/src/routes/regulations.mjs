import express from 'express';
const router = express.Router();

// TEMP sample data (replace later with MongoDB)
const items = [
  { title: 'Rear Setback (RM)', summary: 'Rear setback is 20 ft, can reduce to 15 ft with alley.' },
  { title: 'Max Height (CN)', summary: 'Max building height 35 ft; corner lots 40 ft.' }
];

router.get('/', (req, res) => {
  res.json({ items });
});

export default router;
