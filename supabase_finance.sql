-- Registro economico mensile e modalità di pagamento delle allieve
-- Eseguire una volta nel SQL Editor Supabase.

create table if not exists public.student_payment_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  payment_method text not null default 'monthly' check (payment_method in ('monthly','per_lesson')),
  monthly_fee numeric(10,2) not null default 0 check (monthly_fee >= 0),
  lesson_fee numeric(10,2) not null default 0 check (lesson_fee >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  billing_month date not null,
  payment_scope text not null check (payment_scope in ('monthly','lesson')),
  amount numeric(10,2) not null default 0 check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint payment_scope_lesson_check check (
    (payment_scope = 'monthly' and lesson_id is null) or
    (payment_scope = 'lesson' and lesson_id is not null)
  )
);

create unique index if not exists attendance_payment_month_unique
  on public.attendance_payment_records(user_id,billing_month);
create unique index if not exists attendance_payment_lesson_unique
  on public.attendance_payment_records(user_id,lesson_id);
create index if not exists attendance_payment_month_idx
  on public.attendance_payment_records(billing_month);

alter table public.student_payment_settings enable row level security;
alter table public.attendance_payment_records enable row level security;

drop policy if exists student_payment_settings_admin_all on public.student_payment_settings;
create policy student_payment_settings_admin_all on public.student_payment_settings
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true));

drop policy if exists attendance_payment_admin_all on public.attendance_payment_records;
create policy attendance_payment_admin_all on public.attendance_payment_records
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true));
