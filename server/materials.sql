-- Run once against your QuickFundi database.
-- material_stock: running total of items our fundis have taken, per partner product.
-- material_log:   one row per take/return, so every change is traceable.
CREATE TABLE IF NOT EXISTS material_stock (
  product_id INT PRIMARY KEY,
  taken INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS material_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  quantity INT NOT NULL,            -- positive = taken, negative = returned
  taken_by VARCHAR(60) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
