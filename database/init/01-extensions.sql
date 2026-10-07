-- Runs once when the database is first created.
-- btree_gist lets PostgreSQL enforce "no two confirmed bookings for one room on overlapping dates"
-- (the bookings_no_overlap constraint the API adds on first start).
CREATE EXTENSION IF NOT EXISTS btree_gist;
