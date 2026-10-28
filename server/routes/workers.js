const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /workers  (jobType and location are optional filters)
router.get('/', async (req, res) => {
  const { jobType, location } = req.query;

if ((jobType && typeof jobType !== 'string') || (location && typeof location !== 'string')) {
  return res.status(400).json({ code: 'INVALID_QUERY', message: 'jobType and location must be single values' });
}

  let query = 'SELECT id, name, job_type AS jobType, location, rating, rate_per_hour AS ratePerHour FROM workers WHERE 1=1';
  const params = [];

  if (jobType) {
    query += ' AND job_type = ?';
    params.push(jobType);
  }
  if (location) {
    query += ' AND location LIKE ?';
    params.push(`%${location}%`);
  }

  try {
    const [rows] = await db.query(query, params);
    const mapped = rows.map((r) => ({
      ...r,
      rating: Number(r.rating),
      ratePerHour: Number(r.ratePerHour),
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to fetch workers' });
  }
});

// GET /workers/{id}
router.get('/:id', async (req, res) => {
  try {
    const [workerRows] = await db.query(
      'SELECT id, name, job_type AS jobType, location, rating, rate_per_hour AS ratePerHour, experience_years AS experienceYears FROM workers WHERE id = ?',
      [req.params.id]
    );
    if (workerRows.length === 0) {
      return res.status(404).json({
        code: 'WORKER_NOT_FOUND',
        message: `No worker found with id ${req.params.id}`,
      });
    }

    const [reviewRows] = await db.query(
      'SELECT author, comment, rating FROM reviews WHERE worker_id = ?',
      [req.params.id]
    );

    const worker = workerRows[0];
    worker.rating = Number(worker.rating);
    worker.ratePerHour = Number(worker.ratePerHour);
    worker.reviews = reviewRows;

    res.json(worker);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to fetch worker' });
  }
});

module.exports = router;