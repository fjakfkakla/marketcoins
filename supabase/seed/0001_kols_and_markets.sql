-- Marketcoins · seed : 7 KOLs, stats, 30 jours de PnL et les 2 défis.
-- À exécuter APRÈS 0001_init.sql ET 0002_parimutuel.sql. Rejouable (upserts).

-- ---------------------------------------------------------------
-- KOLs
-- ---------------------------------------------------------------
insert into public.kols (id, name, handle, wallet, avatar_url, color, telegram) values
  ('cooker',     'Cooker',   'CookerFlips', '8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6', '/kols/cooker.jpg',     '#f59e0b', 'https://t.me/CookersCooks'),
  ('cented',     'Cented',   'Cented7',     'CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o', '/kols/cented.jpg',     '#3b82f6', null),
  ('decu',       'decu',     'notdecu',     '4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9', '/kols/decu.jpg',       '#8b5cf6', 'https://t.me/DecusCalls'),
  ('chester',    'chester',  'Chestererer', 'PMJA8UQDyWTFw2Smhyp9jGA6aTaP7jKHR7BPudrgyYN', '/kols/chester.jpg',    '#10b981', null),
  ('blu6k',      'blu6k',    'blu6k',       '8Ltv5royXzxVG3tAhVhRnfXrzapS5Dwqt1ocxprgu6YP', '/kols/blu6k.jpg',      '#06b6d4', null),
  ('zeropnl',    'zeropnl',  'zeropnl',     '4xY9T1Q7foJzJsJ6YZDSsfp9zkzeZsXnxd45SixduMmr', null,                   '#ef4444', null),
  ('trustnoest', 'trunoest', 'trunoest',    'ardinRsN1mNYVeoJWTBsWeYeXvuR9UUDGMsCDKpb6AT', '/kols/trustnoest.jpg', '#ec4899', null)
on conflict (id) do update set
  name = excluded.name, handle = excluded.handle, wallet = excluded.wallet,
  avatar_url = excluded.avatar_url, color = excluded.color, telegram = excluded.telegram;

-- ---------------------------------------------------------------
-- Stats agrégées (valeurs de démo, le cron les écrasera)
-- ---------------------------------------------------------------
insert into public.kol_stats (kol_id, period, pnl_usd, volume_usd, win_rate, trades) values
  ('cooker',     '7D',  39600, 188000, 61, 142), ('cooker',     '30D', 112400, 640000, 59, 510),
  ('cented',     '7D',  29400,  70000, 58,  89), ('cented',     '30D',  96800, 310000, 57, 340),
  ('decu',       '7D',  28800, 125000, 54, 203), ('decu',       '30D',  71200, 480000, 52, 790),
  ('chester',    '7D',  19200,  54000, 63,  61), ('chester',    '30D',  44900, 190000, 60, 240),
  ('blu6k',      '7D',  17100,  35000, 66,  47), ('blu6k',      '30D',  38300, 120000, 64, 170),
  ('zeropnl',    '7D',  12400,  41000, 49, 118), ('zeropnl',    '30D',  25100, 150000, 48, 420),
  ('trustnoest', '7D',   8900,  22000, 57,  38), ('trustnoest', '30D',  31700,  95000, 56, 150)
on conflict (kol_id, period) do update set
  pnl_usd = excluded.pnl_usd, volume_usd = excluded.volume_usd,
  win_rate = excluded.win_rate, trades = excluded.trades, updated_at = now();

-- ---------------------------------------------------------------
-- 30 jours de PnL quotidien (déterministe, somme ≈ pnl 30D)
-- ---------------------------------------------------------------
insert into public.pnl_snapshots (kol_id, snapshot_date, realized_pnl_usd, volume_usd, source)
select
  s.kol_id,
  d::date,
  round((s.pnl_usd / 30.0) * (0.35 + 1.3 * (((extract(doy from d)::int * s.seed) % 11) / 10.0)), 2),
  round((s.volume_usd / 30.0) * (0.5 + ((extract(doy from d)::int * s.seed) % 7) / 6.0), 2),
  'seed'
from (
  select ks.kol_id, ks.pnl_usd, ks.volume_usd,
         row_number() over (order by ks.kol_id) * 7 + 3 as seed
  from public.kol_stats ks where ks.period = '30D'
) s
cross join generate_series(current_date - interval '29 days', current_date, interval '1 day') d
on conflict (kol_id, snapshot_date) do nothing;

-- ---------------------------------------------------------------
-- Marchés
-- ---------------------------------------------------------------
insert into public.markets (slug, title, question, category, period, challenge_no, starts_at, ends_at, closes_at, status, featured, rules) values
(
  'kol-top-profit-7d',
  'Quel KOL fera le plus de profit sur 7 jours ?',
  'Quel KOL fera le plus de profit ?',
  'KOL', '7D', 1,
  '2026-10-13 00:00:00+02', '2026-10-19 20:00:00+02', '2026-10-13 00:00:00+02',
  'OPEN', true,
  array[
    'Le KOL gagnant est celui dont le wallet Solana listé affiche le PnL réalisé le plus élevé entre le lundi 13 octobre 00:00 et le dimanche 19 octobre 20:00 (heure de Paris).',
    'Le PnL est mesuré en USD sur les ventes effectivement réalisées, hors positions ouvertes. Source : données on-chain publiques du wallet.',
    'Chaque mise rejoint la cagnotte du défi après 2 % de frais. À la résolution, toute la cagnotte est partagée entre ceux qui ont misé sur le KOL gagnant, au prorata de leur mise.',
    'Les mises ferment au début de la période et sont définitives : pas de revente. Les cotes affichées sont la répartition actuelle de la cagnotte, le gain final dépend de la cagnotte à la clôture.',
    'En cas d''égalité, de wallet changé ou de données indisponibles, le marché est annulé et toutes les mises sont remboursées.'
  ]
),
(
  'kol-top-profit-30d',
  'Quel KOL fera le plus de profit sur 30 jours ?',
  'Quel KOL fera le plus de profit ?',
  'KOL', '30D', 2,
  '2026-10-13 00:00:00+02', '2026-11-11 20:00:00+01', '2026-10-13 00:00:00+02',
  'OPEN', false,
  array[
    'Le KOL gagnant est celui dont le wallet Solana listé affiche le PnL réalisé le plus élevé sur 30 jours, du 13 octobre 00:00 au 11 novembre 20:00 (heure de Paris).',
    'Le PnL est mesuré en USD sur les ventes réalisées, hors positions ouvertes.',
    'Chaque mise rejoint la cagnotte après 2 % de frais ; la cagnotte est partagée entre les mises sur le KOL gagnant, au prorata. Les mises sont définitives.',
    'En cas d''égalité ou de données indisponibles, le marché est annulé et remboursé.'
  ]
)
on conflict (slug) do update set
  title = excluded.title, question = excluded.question, period = excluded.period,
  challenge_no = excluded.challenge_no, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
  closes_at = excluded.closes_at, featured = excluded.featured, rules = excluded.rules;

-- Un résultat par KOL et par marché. La cagnotte (pool_usd) est alimentée par les mises ci-dessous.
insert into public.outcomes (market_id, kol_id, position, change_24h)
select
  m.id,
  ks.kol_id,
  row_number() over (partition by m.id order by ks.pnl_usd desc) - 1,
  (array[2.4, -0.8, 1.1, -1.6, 0.6, -0.9, -0.8])[row_number() over (partition by m.id order by ks.pnl_usd desc)]
from public.markets m
join public.kol_stats ks on ks.period = m.period
where m.slug in ('kol-top-profit-7d', 'kol-top-profit-30d')
on conflict (market_id, kol_id) do update set
  position = excluded.position, change_24h = excluded.change_24h, updated_at = now();

-- Mises de démo : une cagnotte par défi (31 940 $ sur 7 j, 12 300 $ sur 30 j),
-- répartie comme le mock (poids = PnL^1.35 : les parieurs suivent surtout les meilleurs PnL).
-- Le trigger `bets_apply` ajoute chaque mise nette à outcomes.pool_usd.
with w as (
  select o.id as outcome_id, o.market_id, o.position, m.slug,
         pow(greatest(ks.pnl_usd, 1000), 1.35) as weight
  from public.outcomes o
  join public.markets m on m.id = o.market_id
  join public.kol_stats ks on ks.kol_id = o.kol_id and ks.period = m.period
  where m.slug in ('kol-top-profit-7d', 'kol-top-profit-30d')
),
t as (select market_id, sum(weight) as total from w group by market_id),
x as (
  select w.*,
         round((case when w.slug = 'kol-top-profit-7d' then 31940 else 12300 end) * w.weight / t.total, 2) as stake
  from w join t on t.market_id = w.market_id
)
insert into public.bets (wallet, market_id, outcome_id, amount_usd, fee_usd, stake_usd, created_at)
select
  (array[
    '7Gx2kQmFpZ9vN4tLd8sH3rWcA1eB6yU5oP0jK2nM9xVq',
    'Bq91mNx3Lp8zR2vK7sT4wY6uA1cE5fH9jD0gS8kQ2aa4',
    '3FkdP0mLz9vN2qR7sT4wY6uA1cE5fH8jD1gS2kQ5xm0P',
    '9zLmQe7vN2qR8sT4wY6uA1cE5fH9jD0gS3kQ2xP1mQe7',
    'Hh3sK2RvN2qR8sT4wY6uA1cE5fH9jD0gS3kQ2xP1mk2R',
    'D4rkP0mLz9vN2qR7sT4wY6uA1cE5fH8jD1gS2kQ5xD4r',
    'Ee5tP0mLz9vN2qR7sT4wY6uA1cE5fH8jD1gS2kQ5xEe5'
  ])[x.position + 1],
  x.market_id,
  x.outcome_id,
  round(x.stake / 0.98, 2),
  round(x.stake / 0.98, 2) - x.stake,
  x.stake,
  now() - ((x.position + 1) * 37 || ' minutes')::interval
from x
where not exists (select 1 from public.bets b where b.market_id = x.market_id);
