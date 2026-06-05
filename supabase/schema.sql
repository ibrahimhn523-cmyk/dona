-- ============================================================================
-- مشروع "دونا" — Schema قاعدة البيانات الكامل
-- AI Personal Secretary | PostgreSQL + Supabase
-- النسخة: 1.0 | جاهز للصق في Supabase SQL Editor (idempotent)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- 1) Enumerations (الأولوية والحالات)
-- ----------------------------------------------------------------------------
do $$ begin
  create type priority_level as enum ('high', 'med', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_status as enum ('active', 'achieved', 'paused', 'dropped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('active', 'completed', 'on_hold', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_status as enum ('pending', 'sent', 'dismissed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fact_kind as enum ('person', 'place', 'relationship', 'preference', 'date', 'other');
exception when duplicate_object then null; end $$;


-- ----------------------------------------------------------------------------
-- 2) دالة تحديث updated_at تلقائياً (مشتركة لكل الجداول)
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 3) الجداول — بالترتيب الصحيح للاعتماديات
--    goals -> projects -> tasks -> reminders ، ثم events ، ثم الذاكرة
-- ----------------------------------------------------------------------------

-- 3.1) الأهداف الاستراتيجية
create table if not exists goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  description text,
  priority    priority_level not null default 'med',
  status      goal_status    not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.2) المشاريع — تنتمي لهدف (goal_id nullable)
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  goal_id     uuid references goals (id) on delete set null,
  title       text not null,
  description text,
  priority    priority_level not null default 'med',
  status      project_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.3) المهام — تنتمي لمشروع (project_id nullable)
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid references projects (id) on delete set null,
  title       text not null,
  description text,
  priority    priority_level not null default 'med',
  status      task_status    not null default 'todo',
  due_date    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.4) التذكيرات — قد ترتبط بمهمة (task_id nullable)
create table if not exists reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  task_id     uuid references tasks (id) on delete cascade,
  title       text not null,
  remind_at   timestamptz not null,
  status      reminder_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.5) المواعيد / الأحداث
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  description text,
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at)
);

-- 3.6) الذاكرة الوقائعية — معلومات متراكمة عن العالم
create table if not exists memory_facts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        fact_kind not null default 'other',
  subject     text,
  content     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.7) التفضيلات / الذاكرة الشخصية — صف واحد لكل مستخدم
create table if not exists user_preferences (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  assistant_persona jsonb not null default '{}'::jsonb,
  behavior_rules    jsonb not null default '{}'::jsonb,
  preferences       jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 4) الفهارس (Indexes)
-- ----------------------------------------------------------------------------
create index if not exists idx_goals_user        on goals       (user_id);
create index if not exists idx_projects_user     on projects    (user_id);
create index if not exists idx_projects_goal     on projects    (goal_id);
create index if not exists idx_tasks_user        on tasks       (user_id);
create index if not exists idx_tasks_project     on tasks       (project_id);
create index if not exists idx_tasks_due         on tasks       (user_id, due_date);
create index if not exists idx_reminders_user    on reminders   (user_id);
create index if not exists idx_reminders_task    on reminders   (task_id);
create index if not exists idx_reminders_due     on reminders   (user_id, remind_at);
create index if not exists idx_events_user       on events      (user_id);
create index if not exists idx_events_starts     on events      (user_id, starts_at);
create index if not exists idx_memory_user       on memory_facts(user_id);
create index if not exists idx_memory_kind       on memory_facts(user_id, kind);
create index if not exists idx_memory_metadata   on memory_facts using gin (metadata);


-- ----------------------------------------------------------------------------
-- 5) Triggers لتحديث updated_at تلقائياً
-- ----------------------------------------------------------------------------
drop trigger if exists trg_goals_updated     on goals;
create trigger trg_goals_updated     before update on goals            for each row execute function set_updated_at();
drop trigger if exists trg_projects_updated  on projects;
create trigger trg_projects_updated  before update on projects         for each row execute function set_updated_at();
drop trigger if exists trg_tasks_updated     on tasks;
create trigger trg_tasks_updated     before update on tasks            for each row execute function set_updated_at();
drop trigger if exists trg_reminders_updated on reminders;
create trigger trg_reminders_updated before update on reminders        for each row execute function set_updated_at();
drop trigger if exists trg_events_updated    on events;
create trigger trg_events_updated    before update on events           for each row execute function set_updated_at();
drop trigger if exists trg_memory_updated    on memory_facts;
create trigger trg_memory_updated    before update on memory_facts     for each row execute function set_updated_at();
drop trigger if exists trg_prefs_updated     on user_preferences;
create trigger trg_prefs_updated     before update on user_preferences for each row execute function set_updated_at();


-- ----------------------------------------------------------------------------
-- 6) Row Level Security — تفعيل على كل الجداول
-- ----------------------------------------------------------------------------
alter table goals            enable row level security;
alter table projects         enable row level security;
alter table tasks            enable row level security;
alter table reminders        enable row level security;
alter table events           enable row level security;
alter table memory_facts     enable row level security;
alter table user_preferences enable row level security;


-- ----------------------------------------------------------------------------
-- 7) Policies — المستخدم يصل لصفوفه فقط (user_id = auth.uid())
-- ----------------------------------------------------------------------------
drop policy if exists "owner_all_goals" on goals;
create policy "owner_all_goals" on goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner_all_projects" on projects;
create policy "owner_all_projects" on projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner_all_tasks" on tasks;
create policy "owner_all_tasks" on tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner_all_reminders" on reminders;
create policy "owner_all_reminders" on reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner_all_events" on events;
create policy "owner_all_events" on events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner_all_memory" on memory_facts;
create policy "owner_all_memory" on memory_facts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner_all_prefs" on user_preferences;
create policy "owner_all_prefs" on user_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================================
-- 8) ملاحظة الجلسة المستمرة (تُضبط في لوحة Supabase، ليست SQL)
-- ============================================================================
-- المطلوب: جلسة طويلة الأمد لا تنقطع بالوقت، تنتهي فقط بتسجيل الخروج من كل الأجهزة.
--
-- اضبطه من: Supabase Dashboard -> Authentication -> Settings (Sessions / Tokens)
--
-- الإعدادات المقترحة:
--   • JWT expiry (access token):        3600 ثانية (ساعة) — لا تطوّله.
--   • Refresh token rotation:           Enabled (مفعّل).
--   • Reuse interval:                   10 ثوانٍ.
--   • Inactivity / Time-box expiry:     عطّله (أو الأطول الممكن) لبقاء الجلسة حيّة.
--   • العميل (supabase-js):             persistSession: true, autoRefreshToken: true
--
-- آلية العمل: access token قصير (ساعة) للأمان، و refresh token يُجدّده تلقائياً
-- في الخلفية إلى ما لا نهاية => "جلسة مستمرة" فعلية دون إعادة تسجيل دخول.
-- الخروج من كل الأجهزة: supabase.auth.signOut({ scope: 'global' }) يُبطل كل refresh tokens.
--
-- تنبيه أمني: الجلسة الدائمة مقايضة راحة مقابل أمان. قبل الانتقال لـ multi-user:
-- تشفير تخزين التوكن، تفعيل 2FA، وإضافة خروج تلقائي بعد خمول طويل كخيار.
-- ============================================================================
