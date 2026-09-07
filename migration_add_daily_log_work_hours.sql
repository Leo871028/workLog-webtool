alter table public.daily_logs
add column if not exists work_hours numeric(5,2);
