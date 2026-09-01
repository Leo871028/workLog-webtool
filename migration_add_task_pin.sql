alter table public.tasks
  add column if not exists pinned boolean not null default false;

alter table public.tasks
  add column if not exists pinned_at timestamptz;

create index if not exists tasks_user_pin_idx
  on public.tasks(user_id, pinned, pinned_at desc);
