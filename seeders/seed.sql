-- Seed data for slots
INSERT INTO slots (name, banner_image, slot_image) VALUES
('Mega Fortune', '/uploads/1777284355089-hot_honey_22_vip_9b8b907d51.jpg', '/uploads/1777284285405-spin-back-layer1.jpg'),
('Classic Fruits', '/uploads/1777286828216-backgroundFollowPickerBG.jpg', '/uploads/1777283268430-lam.png'),
('Neon Nights', '/uploads/1777283268427-back.png', '/uploads/1777283268431-neck.png')
ON CONFLICT (name) DO NOTHING;

-- Seed data for slot_symbols (assuming specific IDs or looking up by name)
-- For simplicity in SQL, we can use subqueries if needed, but usually a JS seeder is more practical for dynamic IDs.
-- Here is a sample join-based approach if we wanted to do it in SQL:

INSERT INTO slot_symbols (slot_id, image_url, color_hint, sort_order)
SELECT id, '/uploads/1777284285408-symbol7.png', '#FFD700', 1 FROM slots WHERE name = 'Mega Fortune'
UNION ALL
SELECT id, '/uploads/1777284285408-symbol8.png', '#C0C0C0', 2 FROM slots WHERE name = 'Mega Fortune'
UNION ALL
SELECT id, '/uploads/1777286828220-downloa8.png', '#FF4500', 3 FROM slots WHERE name = 'Mega Fortune'
UNION ALL
SELECT id, '/uploads/1777286828221-download1.png', '#32CD32', 4 FROM slots WHERE name = 'Mega Fortune'
UNION ALL
SELECT id, '/uploads/1777286828221-download2.png', '#1E90FF', 5 FROM slots WHERE name = 'Mega Fortune';

INSERT INTO slot_symbols (slot_id, image_url, color_hint, sort_order)
SELECT id, '/uploads/1777284285408-symbol7.png', '#FFD700', 1 FROM slots WHERE name = 'Classic Fruits'
UNION ALL
SELECT id, '/uploads/1777284285408-symbol8.png', '#C0C0C0', 2 FROM slots WHERE name = 'Classic Fruits';
