-- CodeSim: initial schema

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Named codesim_profiles (not profiles) so CodeSim can share a Supabase project
-- with ShareWallet, which has its own profiles table.
create table codesim_profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table frameworks (
  id text primary key, -- e.g., 'react', 'nextjs', 'rust'
  name text not null,
  icon_url text,
  description text,
  -- 'browser' runs in the sandboxed iframe; 'judge0' is proxied to /api/execute
  runtime text not null default 'browser' check (runtime in ('browser', 'judge0'))
);

create table problems (
  id uuid default uuid_generate_v4() primary key,
  framework_id text references frameworks(id) on delete cascade,
  title text not null,
  slug text unique not null,
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  concept_tags text[], -- e.g., ['useCallback', 'Server Actions', 'Borrow Checker']
  description_md text not null,
  starter_code jsonb not null, -- { "App.jsx": "export default function..." }
  solution_code jsonb not null, -- never exposed to clients, see grants below
  test_suite jsonb not null, -- see README "Test suite format"
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table user_submissions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  problem_id uuid references problems(id) on delete cascade,
  status text check (status in ('passed', 'failed', 'runtime_error')),
  execution_time_ms integer,
  time_spent_seconds integer check (time_spent_seconds >= 0),
  submitted_code jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table user_framework_stats (
  user_id uuid references auth.users(id) on delete cascade,
  framework_id text references frameworks(id) on delete cascade,
  xp integer default 0,
  problems_solved integer default 0,
  time_spent_seconds integer default 0,
  primary key (user_id, framework_id)
);

-- Public feed of first-time solves; drives the realtime leaderboard.
create table solve_feed (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  problem_title text not null,
  framework_id text references frameworks(id) on delete cascade,
  difficulty text,
  xp_awarded integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create index on problems (framework_id);
create index on user_submissions (user_id, created_at desc);
create index on user_submissions (user_id, problem_id) where status = 'passed';
create index on solve_feed (created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function codesim_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into codesim_profiles (id, username, avatar_url)
  values (
    new.id,
    -- suffix keeps usernames unique when two emails share a local part
    coalesce(new.raw_user_meta_data ->> 'user_name', split_part(new.email, '@', 1))
      || '-' || substr(new.id::text, 1, 4),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger codesim_on_auth_user_created
  after insert on auth.users
  for each row execute function codesim_handle_new_user();

-- Keeps user_framework_stats and solve_feed in sync with submissions.
-- XP is only awarded for the first passing submission of a problem.
create or replace function apply_submission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_problem problems;
  v_first_pass boolean;
  v_xp integer := 0;
begin
  select * into v_problem from problems where id = new.problem_id;

  v_first_pass := new.status = 'passed' and not exists (
    select 1 from user_submissions
    where user_id = new.user_id and problem_id = new.problem_id
      and status = 'passed' and id <> new.id
  );

  if v_first_pass then
    v_xp := case v_problem.difficulty when 'advanced' then 50 when 'intermediate' then 25 else 10 end;
  end if;

  insert into user_framework_stats (user_id, framework_id, xp, problems_solved, time_spent_seconds)
  values (new.user_id, v_problem.framework_id, v_xp, v_first_pass::int, coalesce(new.time_spent_seconds, 0))
  on conflict (user_id, framework_id) do update set
    xp = user_framework_stats.xp + excluded.xp,
    problems_solved = user_framework_stats.problems_solved + excluded.problems_solved,
    time_spent_seconds = user_framework_stats.time_spent_seconds + excluded.time_spent_seconds;

  if v_first_pass then
    insert into solve_feed (user_id, username, problem_title, framework_id, difficulty, xp_awarded)
    select new.user_id, p.username, v_problem.title, v_problem.framework_id, v_problem.difficulty, v_xp
    from codesim_profiles p where p.id = new.user_id;
  end if;

  return new;
end;
$$;

create trigger on_submission_inserted
  after insert on user_submissions
  for each row execute function apply_submission();

-- ---------------------------------------------------------------------------
-- Row Level Security & grants
-- ---------------------------------------------------------------------------

alter table codesim_profiles enable row level security;
alter table frameworks enable row level security;
alter table problems enable row level security;
alter table user_submissions enable row level security;
alter table user_framework_stats enable row level security;
alter table solve_feed enable row level security;

create policy "Profiles are public" on codesim_profiles for select using (true);
create policy "Users update their own profile" on codesim_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Frameworks are public" on frameworks for select using (true);
create policy "Problems are public" on problems for select using (true);

-- solution_code must never reach the browser: RLS is row-level, so hide the
-- column with column privileges instead.
revoke select on problems from anon, authenticated;
grant select (id, framework_id, title, slug, difficulty, concept_tags, description_md,
              starter_code, test_suite, created_at)
  on problems to anon, authenticated;

create policy "Users read their own submissions" on user_submissions
  for select using (user_id = auth.uid());
create policy "Users record their own submissions" on user_submissions
  for insert with check (user_id = auth.uid());

-- Stats and the feed are public (leaderboards) and written only by the trigger.
create policy "Stats are public" on user_framework_stats for select using (true);
create policy "Solve feed is public" on solve_feed for select using (true);

revoke insert, update, delete on user_framework_stats, solve_feed from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard view
-- ---------------------------------------------------------------------------

create view leaderboard with (security_invoker = true) as
  select s.user_id,
         p.username,
         p.avatar_url,
         sum(s.xp)::int as total_xp,
         sum(s.problems_solved)::int as problems_solved
  from user_framework_stats s
  join codesim_profiles p on p.id = s.user_id
  group by s.user_id, p.username, p.avatar_url;

grant select on leaderboard to anon, authenticated;

alter publication supabase_realtime add table solve_feed;
