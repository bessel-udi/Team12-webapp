INSERT IGNORE INTO workers (id, name, job_type, location, rating, rate_per_hour, experience_years) VALUES
  ('wk_1045', 'Mary Wanjiku', 'electrician', 'Nairobi, Westlands', 4.6, 850, 8),
  ('wk_1046', 'David Ochieng', 'plumber', 'Nairobi, Kilimani', 4.7, 750, 7),
  ('wk_1047', 'Esther Njeri', 'handyman', 'Nairobi, Upper Hill', 4.4, 650, 5),
  ('wk_1048', 'Brian Mutua', 'electrician', 'Nairobi, Kileleshwa', 4.3, 780, 4),
  ('wk_1049', 'Joseph Kiprop', 'plumber', 'Nairobi, Lavington', 4.9, 900, 10);

INSERT INTO reviews (worker_id, author, comment, rating) VALUES
  ('wk_1043', 'Linet A.', 'Replaced our old pipes neatly.', 4),
  ('wk_1044', 'Kevin O.', 'Fixed the door frames in one visit.', 4),
  ('wk_1044', 'Ruth W.', 'Reliable and fairly priced.', 5),
  ('wk_1045', 'Peter M.', 'Rewired the clinic lights without fuss.', 5),
  ('wk_1046', 'Amina S.', 'Found the leak fast and cleaned up after.', 5),
  ('wk_1047', 'Samuel T.', 'Good work on shelving and repairs.', 4),
  ('wk_1048', 'Janet K.', 'Arrived on time and explained the fault.', 4),
  ('wk_1049', 'Michael N.', 'Best plumber we have used.', 5);

INSERT IGNORE INTO bookings (id, worker_id, job_type, location, scheduled_for, status, requested_by) VALUES
  ('bk_5001', 'wk_1042', 'electrician', 'Nairobi Hospital, Ward 4', '2026-11-10 09:00:00', 'pending', 'HospitalQ Facilities Desk'),
  ('bk_5002', 'wk_1043', 'plumber', 'Nairobi Hospital, Ward 2', '2026-11-11 10:30:00', 'pending', 'HospitalQ Facilities Desk'),
  ('bk_5003', 'wk_1044', 'handyman', 'Nairobi Hospital, Reception', '2026-11-05 14:00:00', 'in_progress', 'HospitalQ Maintenance Office'),
  ('bk_5004', 'wk_1045', 'electrician', 'Nairobi Hospital, Theatre 1', '2026-10-15 08:00:00', 'completed', 'HospitalQ Facilities Desk'),
  ('bk_5005', 'wk_1046', 'plumber', 'Nairobi Hospital, Kitchen', '2026-10-20 11:00:00', 'cancelled', 'HospitalQ Maintenance Office'),
  ('bk_5006', 'wk_1049', 'plumber', 'Nairobi Hospital, Ward 6', '2026-11-18 13:00:00', 'pending', 'HospitalQ Facilities Desk');
