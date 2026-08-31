create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  priority text not null default 'Medium' check (priority in ('Low','Medium','High')),
  status text not null default 'Todo' check (status in ('Todo','Ongoing','Done')),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists deadline date;

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  completed text not null default '',
  ongoing text not null default '',
  blockers text not null default '',
  next_plan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.tasks enable row level security;
alter table public.daily_logs enable row level security;

drop policy if exists tasks_select_own on public.tasks;
drop policy if exists tasks_insert_own on public.tasks;
drop policy if exists tasks_update_own on public.tasks;
drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_select_own on public.tasks for select to authenticated using (auth.uid() = user_id);
create policy tasks_insert_own on public.tasks for insert to authenticated with check (auth.uid() = user_id);
create policy tasks_update_own on public.tasks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_delete_own on public.tasks for delete to authenticated using (auth.uid() = user_id);

drop policy if exists logs_select_own on public.daily_logs;
drop policy if exists logs_insert_own on public.daily_logs;
drop policy if exists logs_update_own on public.daily_logs;
drop policy if exists logs_delete_own on public.daily_logs;
create policy logs_select_own on public.daily_logs for select to authenticated using (auth.uid() = user_id);
create policy logs_insert_own on public.daily_logs for insert to authenticated with check (auth.uid() = user_id);
create policy logs_update_own on public.daily_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy logs_delete_own on public.daily_logs for delete to authenticated using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.daily_logs to authenticated;
