create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  priority text not null default 'Medium' check (priority in ('Low','Medium','High')),
  status text not null default 'Todo' check (status in ('Todo','Ongoing','Done')),
  deadline date,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists deadline date;
alter table public.tasks add column if not exists archived boolean not null default false;
alter table public.tasks add column if not exists archived_at timestamptz;
create index if not exists tasks_user_archived_idx on public.tasks (user_id, archived);

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

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  task_title text not null default '',
  event_type text not null,
  old_value text,
  new_value text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_activity_user_created_idx on public.task_activity(user_id, created_at desc);
create index if not exists task_activity_user_task_idx on public.task_activity(user_id, task_id, created_at desc);

alter table public.tasks enable row level security;
alter table public.daily_logs enable row level security;
alter table public.task_activity enable row level security;

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

drop policy if exists task_activity_select_own on public.task_activity;
drop policy if exists task_activity_insert_own on public.task_activity;
drop policy if exists task_activity_delete_own on public.task_activity;
create policy task_activity_select_own on public.task_activity for select to authenticated using (auth.uid() = user_id);
create policy task_activity_insert_own on public.task_activity for insert to authenticated with check (auth.uid() = user_id);
create policy task_activity_delete_own on public.task_activity for delete to authenticated using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.daily_logs to authenticated;
grant select, insert, delete on public.task_activity to authenticated;

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity(user_id, task_id, task_title, event_type, new_value, details, created_at)
    values (new.user_id, new.id, new.title, 'created', new.status, jsonb_build_object('priority', new.priority, 'deadline', new.deadline, 'status', new.status), coalesce(new.created_at, now()));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into public.task_activity(user_id, task_id, task_title, event_type, old_value, new_value)
      values (new.user_id, new.id, new.title, 'status_changed', old.status, new.status);
    end if;
    if old.priority is distinct from new.priority then
      insert into public.task_activity(user_id, task_id, task_title, event_type, old_value, new_value)
      values (new.user_id, new.id, new.title, 'priority_changed', old.priority, new.priority);
    end if;
    if old.deadline is distinct from new.deadline then
      insert into public.task_activity(user_id, task_id, task_title, event_type, old_value, new_value)
      values (new.user_id, new.id, new.title, 'deadline_changed', old.deadline::text, new.deadline::text);
    end if;
    if old.title is distinct from new.title then
      insert into public.task_activity(user_id, task_id, task_title, event_type, old_value, new_value)
      values (new.user_id, new.id, new.title, 'title_changed', old.title, new.title);
    end if;
    if old.description is distinct from new.description then
      insert into public.task_activity(user_id, task_id, task_title, event_type, details)
      values (new.user_id, new.id, new.title, 'description_changed', jsonb_build_object('changed', true));
    end if;
    if coalesce(old.archived, false) is distinct from coalesce(new.archived, false) then
      if coalesce(new.archived, false) then
        insert into public.task_activity(user_id, task_id, task_title, event_type, old_value, new_value)
        values (new.user_id, new.id, new.title, 'archived', 'active', 'archived');
      else
        insert into public.task_activity(user_id, task_id, task_title, event_type, old_value, new_value)
        values (new.user_id, new.id, new.title, 'restored', 'archived', new.status);
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.task_activity(user_id, task_id, task_title, event_type, old_value, details)
    values (old.user_id, old.id, old.title, 'deleted', old.status, jsonb_build_object('priority', old.priority, 'deadline', old.deadline, 'archived', coalesce(old.archived, false)));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_task_activity on public.tasks;
create trigger trg_task_activity after insert or update or delete on public.tasks for each row execute function public.log_task_activity();
