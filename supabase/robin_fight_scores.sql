create table if not exists public.robin_fight_scores (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  score integer not null,
  wave integer not null,
  winner boolean not null default false,
  duration_seconds integer,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint robin_fight_scores_username_len check (char_length(username) between 1 and 18),
  constraint robin_fight_scores_username_safe check (username ~ '^[A-Za-z0-9 _.-]+$'),
  constraint robin_fight_scores_score_range check (score between 0 and 100000),
  constraint robin_fight_scores_wave_range check (wave between 1 and 5),
  constraint robin_fight_scores_duration_range check (duration_seconds is null or duration_seconds between 0 and 7200)
);

alter table public.robin_fight_scores enable row level security;

drop policy if exists "Public can read Robin Fight scores" on public.robin_fight_scores;
drop policy if exists "Public can submit Robin Fight scores" on public.robin_fight_scores;

revoke all on public.robin_fight_scores from anon, authenticated;

create index if not exists robin_fight_scores_score_idx
  on public.robin_fight_scores (score desc, created_at asc);

create index if not exists robin_fight_scores_created_at_idx
  on public.robin_fight_scores (created_at desc);

create or replace function public.get_robin_fight_leaderboard()
returns table (
  username text,
  score integer,
  wave integer,
  winner boolean,
  duration_seconds integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.username,
    s.score,
    s.wave,
    s.winner,
    s.duration_seconds,
    s.created_at
  from public.robin_fight_scores as s
  order by s.score desc, s.created_at asc
  limit 10;
$$;

revoke all on function public.get_robin_fight_leaderboard() from public;
grant execute on function public.get_robin_fight_leaderboard() to anon, authenticated;
