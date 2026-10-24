-- Veriq Health sample data. The data itself lives in public.reset_demo() (migration
-- 20261024000004_reset_demo.sql), so the CLI seed, the tests and the "Reset demo data" button
-- (Prompt 8, /admin/demo) all run the same SQL. Safe to run again.
select public.reset_demo();
