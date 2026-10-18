CREATE TABLE IF NOT EXISTS workers (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  job_type ENUM('electrician', 'plumber', 'handyman') NOT NULL,
  location VARCHAR(150) NOT NULL,
  rating DECIMAL(2,1) DEFAULT 0,
  rate_per_hour DECIMAL(10,2) NOT NULL,
  experience_years INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(20) PRIMARY KEY,
  worker_id VARCHAR(20) NOT NULL,
  job_type ENUM('electrician', 'plumber', 'handyman') NOT NULL,
  location VARCHAR(150) NOT NULL,
  scheduled_for DATETIME NOT NULL,
  status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  requested_by VARCHAR(150),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  worker_id VARCHAR(20) NOT NULL,
  author VARCHAR(100) NOT NULL,
  comment TEXT,
  rating INT NOT NULL,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

INSERT INTO workers (id, name, job_type, location, rating, rate_per_hour, experience_years) VALUES
  ('wk_1042', 'James Otieno', 'electrician', 'Nairobi, Upper Hill', 4.8, 800, 6),
  ('wk_1043', 'Peter Kamau', 'plumber', 'Nairobi, Westlands', 4.5, 700, 4),
  ('wk_1044', 'Samuel Mwangi', 'handyman', 'Nairobi, Kilimani', 4.2, 600, 3);

INSERT INTO reviews (worker_id, author, comment, rating) VALUES
  ('wk_1042', 'Grace M.', 'Fixed our wiring fault quickly.', 5),
  ('wk_1042', 'Daniel K.', 'Professional and on time.', 4),
  ('wk_1043', 'Faith N.', 'Solved a stubborn leak fast.', 5);
