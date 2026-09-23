-- Local demo data. Run with --local only; never against the production database.
DELETE FROM interests;
DELETE FROM posts;
INSERT INTO posts (id, host_name, phone, area, district, division, turf_name, start_datetime, duration_minutes, cost_per_head, slots_needed, notes, status, contact_mode, edit_token) VALUES
  ('seedsoon01', 'Rafi',   '8801712345678', 'Mirpur', 'dhaka', 'div-dhaka',     'Kings Arena',       strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+75 minutes'), 60,  150, 1, 'Bring gloves',          'open',   'direct',   'seed'),
  ('seedfill01', 'Tanvir', '8801812345678', 'Dhanmondi', 'dhaka', 'div-dhaka',  'Jaff Futsal',       strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+2 hours'),    60,  120, 1, NULL,                    'filled', 'direct',   'seed'),
  ('seedtoday1', 'Nabil',  '8801912345678', 'Mirpur', 'dhaka', 'div-dhaka',     'Striker Turf',      strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+5 hours'),    90,  200, 2, 'Friendly, mixed level', 'open',   'requests', 'seed'),
  ('seedtmrw01', 'Sakib',  '8801612345678', 'Agrabad', 'chattogram', 'div-chattogram',    NULL,                strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 day'),      60,  NULL, 1, NULL,                   'open',   'direct',   'seed'),
  ('seedtmrw02', 'Ayon',   '8801512345678', 'Uttara', 'dhaka', 'div-dhaka',     'Sector 7 Arena',    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 day', '+3 hours'), 60, 180, 1, NULL,            'open',   'direct',   'seed'),
  ('seedweek01', 'Fahim',  '8801312345678', 'Zindabazar', 'sylhet', 'div-sylhet', 'Sylhet Futsal Hub', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+3 days'),     60,  100, 1, NULL,                    'open',   'requests', 'seed');
