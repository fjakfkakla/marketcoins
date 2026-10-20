-- Marketcoins · migration 0002 : passage au modèle parimutuel (cagnotte).
-- À exécuter APRÈS 0001_init.sql, AVANT le seed. Idempotente.
--
-- Avant : parts « Oui / Non » à prix fixe (outcomes.prob, trades, positions).
-- Après : chaque mise (bets) rejoint la cagnotte de son KOL (outcomes.pool_usd) ;
--         à la résolution la cagnotte du marché est partagée entre les mises
--         sur le KOL gagnant, au prorata. Pas de prix, pas de revente.

-- ---------------------------------------------------------------
-- Cagnotte par résultat
-- ---------------------------------------------------------------
alter table public.outcomes
  add column if not exists pool_usd numeric(18,2) not null default 0 check (pool_usd >= 0);

-- La probabilité n'est plus une donnée : c'est pool_usd / cagnotte du marché.
alter table public.outcomes drop column if exists prob;

-- ---------------------------------------------------------------
-- Mises (écrites uniquement par le serveur, depuis les transactions on-chain)
-- ---------------------------------------------------------------
create table if not exists public.bets (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null,
  market_id     uuid not null references public.markets(id),
  outcome_id    uuid not null references public.outcomes(id),
  amount_usd    numeric(18,2) not null check (amount_usd > 0),   -- débité du parieur
  fee_usd       numeric(18,2) not null default 0 check (fee_usd >= 0),
  stake_usd     numeric(18,2) not null check (stake_usd > 0),    -- entré dans la cagnotte
  payout_usd    numeric(18,2),                                   -- renseigné à la résolution
  tx_signature  text unique,                                     -- signature Solana
  created_at    timestamptz not null default now(),
  check (amount_usd = fee_usd + stake_usd)
);
create index if not exists bets_market_created_idx on public.bets (market_id, created_at desc);
create index if not exists bets_outcome_idx on public.bets (outcome_id);
create index if not exists bets_wallet_idx on public.bets (wallet);

-- Chaque mise nette alimente la cagnotte de son résultat.
create or replace function public.apply_bet() returns trigger
language plpgsql as $$
begin
  update public.outcomes set pool_usd = pool_usd + new.stake_usd where id = new.outcome_id;
  return new;
end $$;

drop trigger if exists bets_apply on public.bets;
create trigger bets_apply after insert on public.bets for each row execute function public.apply_bet();

-- ---------------------------------------------------------------
-- Ancien modèle : plus utilisé (aucune écriture n'a jamais eu lieu hors seed)
-- ---------------------------------------------------------------
drop view if exists public.market_stats;
drop table if exists public.positions;
drop table if exists public.trades;

-- ---------------------------------------------------------------
-- Vue : volume et nombre de parieurs par marché (la cagnotte se lit sur outcomes.pool_usd)
-- ---------------------------------------------------------------
create view public.market_stats as
select
  m.id as market_id,
  coalesce(sum(b.amount_usd), 0)::numeric(18,2) as volume_usd,
  coalesce(sum(b.stake_usd), 0)::numeric(18,2)  as pool_usd,
  count(distinct b.wallet)                       as traders
from public.markets m
left join public.bets b on b.market_id = m.id
group by m.id;

-- ---------------------------------------------------------------
-- Row Level Security : mises publiques en lecture (wallets déjà visibles on-chain), aucune écriture client
-- ---------------------------------------------------------------
alter table public.bets enable row level security;
drop policy if exists "bets_public_read" on public.bets;
create policy "bets_public_read" on public.bets for select to anon, authenticated using (true);
revoke insert, update, delete on public.bets from anon, authenticated;
