const express = require('express');
const router = express.Router();

// TEMP sample data (replace later with MongoDB)
const items = [
  { name: 'Bethesda Tabernacle Site Plan', jurisdiction: 'Greenacres', status: 'In Review' },
  { name: 'Downtown Mixed-Use', jurisdiction: 'Lake Worth Beach', status: 'Draft' }
];

router.get('/', (req, res) => {
  res.json({ items });
});

module.exports = router;
