-- Set the next display order number to 55253 for PostgreSQL
-- Run this against your database (psql or any SQL client) after running Prisma migrations.

DO $$
DECLARE
  seq_name text;
BEGIN
  seq_name := pg_get_serial_sequence('"Order"', 'displayOrderNumber');
  IF seq_name IS NOT NULL THEN
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', seq_name, 55253);
    RAISE NOTICE 'Sequence % set to start at %', seq_name, 55253;
  ELSE
    RAISE NOTICE 'Sequence for "Order".displayOrderNumber not found. Ensure migrations created the sequence.';
  END IF;
END$$;

-- Alternative manual commands (if you know the sequence name):
-- ALTER SEQUENCE "Order_displayOrderNumber_seq" RESTART WITH 55253;
