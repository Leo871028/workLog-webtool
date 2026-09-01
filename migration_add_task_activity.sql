create extension if not exists pgcrypto;

alter table public.tasks add column if not exists archived boolean not null default false;
alter table public.tasks add column if not exists archived_at timestamptz;

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

create index if not exists task_activity_user_created_idx
  on public.task_activity(user_id, created_at desc);
create index if not exists task_activity_user_task_idx
  on public.task_activity(user_id, task_id, created_at desc);

alter table public.task_activity enable row level security;

drop policy if exists task_activity_select_own on public.task_activity;
drop policy if exists task_activity_insert_own on public.task_activity;
drop policy if exists task_activity_delete_own on public.task_activity;
create policy task_activity_select_own on public.task_activity
  for select to authenticated using (auth.uid() = user_id);
create policy task_activity_insert_own on public.task_activity
  for insert to authenticated with check (auth.uid() = user_id);
create policy task_activity_delete_own on public.task_activity
  for delete to authenticated using (auth.uid() = user_id);

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
    values (
      new.user_id,
      new.id,
      new.title,
      'created',
      new.status,
      jsonb_build_object('priority', new.priority, 'deadline', new.deadline, 'status', new.status),
      coalesce(new.created_at, now())
    );
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
    values (
      old.user_id,
      old.id,
      old.title,
      'deleted',
      old.status,
      jsonb_build_object('priority', old.priority, 'deadline', old.deadline, 'archived', coalesce(old.archived, false))
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_task_activity on public.tasks;
create trigger trg_task_activity
after insert or update or delete on public.tasks
for each row execute function public.log_task_activity();

insert into public.task_activity(user_id, task_id, task_title, event_type, new_value, details, created_at)
select
  t.user_id,
  t.id,
  t.title,
  'created',
  t.status,
  jsonb_build_object('priority', t.priority, 'deadline', t.deadline, 'status', t.status, 'backfilled', true),
  t.created_at
from public.tasks t
where not exists (
  select 1 from public.task_activity a
  where a.user_id = t.user_id and a.task_id = t.id and a.event_type = 'created'
);
