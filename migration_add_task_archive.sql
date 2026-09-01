alter table public.tasks
  add column if not exists archived boolean not null default false;

alter table public.tasks
  add column if not exists archived_at timestamptz;

create index if not exists tasks_user_archived_idx
  on public.tasks (user_id, archived);
