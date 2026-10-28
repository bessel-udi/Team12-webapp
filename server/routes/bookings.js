const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

const VALID_JOB_TYPES = ['electrician', 'plumber', 'handyman'];

// Converts an ISO date string to MySQL's DATETIME format (UTC), e.g. 2026-11-01 09:00:00
const toMysqlDate = (iso) => new Date(iso).toISOString().slice(0, 19).replace('T', ' ');

// POST /bookings
router.post('/', async (req, res) => {
  const { workerId, jobType, location, scheduledFor, requestedBy } = req.body;

  if (!workerId || !jobType || !location || !scheduledFor || !requestedBy) {
    return res.status(400).json({
      code: 'INVALID_BOOKING',
      message: 'workerId, jobType, location, scheduledFor, and requestedBy are all required',
    });
  }

  if ([workerId, jobType, location, scheduledFor, requestedBy].some((v) => typeof v !== 'string')) {
    return res.status(400).json({ code: 'INVALID_BOOKING', message: 'All fields must be strings' });
  }

  if (!VALID_JOB_TYPES.includes(jobType)) {
    return res.status(400).json({
      code: 'INVALID_BOOKING',
      message: `jobType must be one of: ${VALID_JOB_TYPES.join(', ')}`,
    });
  }

  if (isNaN(Date.parse(scheduledFor))) {
    return res.status(400).json({
      code: 'INVALID_BOOKING',
      message: 'scheduledFor must be a valid ISO 8601 date-time',
    });
  }

  try {
    const id = `bk_${crypto.randomBytes(16).toString('hex')}`;
    await db.query(
      'INSERT INTO bookings (id, worker_id, job_type, location, scheduled_for, requested_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, workerId, jobType, location, toMysqlDate(scheduledFor), requestedBy]
    );
    const [rows] = await db.query(
      'SELECT id, worker_id AS workerId, job_type AS jobType, location, scheduled_for AS scheduledFor, status, created_at AS createdAt FROM bookings WHERE id = ?',
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to create booking' });
  }
});

// GET /bookings/{id}
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, worker_id AS workerId, job_type AS jobType, location, scheduled_for AS scheduledFor, status, created_at AS createdAt FROM bookings WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({
        code: 'BOOKING_NOT_FOUND',
        message: `No booking found with id ${req.params.id}`,
      });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to fetch booking' });
  }
});

// PATCH /bookings/{id} — reschedule
router.patch('/:id', async (req, res) => {
  const { scheduledFor } = req.body;

  if (!scheduledFor) {
    return res.status(400).json({
      code: 'INVALID_RESCHEDULE',
      message: 'scheduledFor is required',
    });
  }

  if (isNaN(Date.parse(scheduledFor))) {
    return res.status(400).json({
      code: 'INVALID_RESCHEDULE',
      message: 'scheduledFor must be a valid ISO 8601 date-time',
    });
  }

  try {
    const [existing] = await db.query('SELECT status FROM bookings WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        code: 'BOOKING_NOT_FOUND',
        message: `No booking found with id ${req.params.id}`,
      });
    }
    if (existing[0].status === 'completed') {
      return res.status(409).json({
        code: 'BOOKING_NOT_RESCHEDULABLE',
        message: `Booking ${req.params.id} is already completed and cannot be rescheduled`,
      });
    }
    await db.query('UPDATE bookings SET scheduled_for = ? WHERE id = ?', [toMysqlDate(scheduledFor), req.params.id]);
    const [rows] = await db.query(
      'SELECT id, worker_id AS workerId, job_type AS jobType, location, scheduled_for AS scheduledFor, status, created_at AS createdAt FROM bookings WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to reschedule booking' });
  }
});

// DELETE /bookings/{id}
router.delete('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT status FROM bookings WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        code: 'BOOKING_NOT_FOUND',
        message: `No booking found with id ${req.params.id}`,
      });
    }
    if (existing[0].status === 'completed') {
      return res.status(409).json({
        code: 'BOOKING_NOT_CANCELLABLE',
        message: `Booking ${req.params.id} is already completed and cannot be cancelled`,
      });
    }
    await db.query('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to cancel booking' });
  }
});

module.exports = router;