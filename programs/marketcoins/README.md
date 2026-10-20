# Programme Solana `marketcoins` (Anchor)

Cagnotte parimutuel on-chain : une cagnotte en USDC par défi, les gagnants se la partagent au prorata. Le programme ne promet jamais plus que ce qu'il détient : à tout instant, le vault contient Σ cagnottes + frais.

## Cycle de vie d'un défi

| Étape | Instruction | Qui | Quand |
|---|---|---|---|
| 1 | `create_market` | autorité (nous) | avant l'ouverture |
| 2 | `place_bet(outcome, amount)` | n'importe quel wallet | jusqu'à `closes_at` |
| 3 | `resolve(winner)` | résolveur (multisig) | à partir de `ends_at` ; re-jouable pendant la contestation pour corriger |
| 3b | `cancel` | résolveur | marché ouvert, ou pendant la contestation |
| 4 | `claim` | chaque parieur | contestation écoulée (gagnants) ou marché annulé (tout le monde) |
| 5 | `withdraw_fees` | autorité | marché définitif |

Règles encodées :

- **Frais** : `fee_bps` (0 sur Marketcoins ; 200 = 2 %) prélevés sur chaque mise, gardés dans le vault jusqu'à `withdraw_fees`. Le reste (`stake`) rejoint la cagnotte du résultat.
- **Mises définitives** : aucune instruction de revente ou d'annulation d'une mise individuelle.
- **Gain** : `stake × total_pool ÷ pools[winner]`, arrondi vers le bas. La somme des gains ne dépasse jamais la cagnotte, la poussière reste dans le vault.
- **Contestation** : `dispute_seconds` après `resolve` (24 h en production). Pendant cette fenêtre, pas de retrait ; le résolveur peut corriger (`resolve` à nouveau) ou annuler. Après, le marché est définitif, plus rien ne bouge.
- **Annulation** : toutes les mises sont remboursées intégralement, frais compris. Automatique si personne n'a misé sur le gagnant.
- **Garde-fous** : 2 à 16 résultats, frais ≤ 10 %, contestation ≤ 7 jours, `closes_at ≤ ends_at`, arithmétique vérifiée (`checked_*`, `overflow-checks`).

## Comptes

- `Market` · PDA `["market", market_id u64 LE]` : paramètres, statut, `pools[16]`, `total_pool`, `total_volume`, `fees_accrued`.
- vault · PDA `["vault", market]` : compte token USDC dont l'autorité est le `Market`.
- `Bet` · PDA `["bet", market, bettor, outcome u8]` : `amount` (brut), `stake` (net). Plusieurs mises d'un même wallet sur un même résultat s'additionnent. Fermé par `claim`, le loyer revient au parieur.

Événements émis (`MarketCreated`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, `Claimed`, `FeesWithdrawn`) : c'est ce que l'indexeur écoutera pour remplir `bets` et `outcomes.pool_usd` dans Supabase.

## Correspondance avec le site

Le site fonctionne aujourd'hui en **pot commun custodial** : dépôts USDC vers un coffre, registre et mises dans
Supabase, paiement du pot par le serveur (`src/lib/pot.ts`, `src/lib/challenges.ts`). Ce programme est la version
**non-custodiale** du même pot : mêmes règles, mais l'argent reste dans un compte du programme et chaque mise ou
retrait est signé par le joueur. Il n'est **pas encore branché** au site.

| Site (`src/lib/pot.ts`) | Programme |
|---|---|
| `challenge_no` du défi | `market_id` |
| `outcomes[i].pool` | `pools[i]` ÷ 10⁶ |
| pot | `total_pool` ÷ 10⁶ |
| `odds(pot, pool)` | `total_pool ÷ pools[i]` |
| `payoutOf(pot, pool, stake)` | formule de `claim` |
| 0 % de frais | `fee_bps = 0` (le programme accepte jusqu'à 10 %) |
| 24 h entre proposition et paiement | `dispute_seconds = 86 400` |

## Développement

Prérequis : Rust, Solana CLI (`agave`), Anchor CLI 1.2.x, Node.

```bash
anchor build                     # compile + génère target/idl et target/types
anchor test --validator legacy   # lance solana-test-validator et tests/marketcoins.ts (= npm run test:program)
anchor keys sync                 # avant un premier déploiement : nouvelle clé de programme
anchor deploy --provider.cluster devnet
```

Anchor 1.2 lance Surfpool par défaut ; `--validator legacy` utilise `solana-test-validator`, fourni avec la CLI Solana. Les tests jouent avec de vraies horloges (fermeture des mises, fin du défi, contestation en quelques secondes), comptez ~40 s.

La clé du programme (`target/deploy/marketcoins-keypair.json`) n'est pas versionnée : `anchor keys sync` en génère une et met à jour `declare_id!` et `Anchor.toml`.

Les tests couvrent : mises et frais, mises cumulées, mises refusées (résultat inconnu, montant nul, après fermeture), résolution refusée avant la fin, autorité du résolveur, correction pendant la contestation, retraits bloqués pendant la contestation, paiement au prorata exact, double retrait impossible, retrait des frais, annulation manuelle, annulation automatique sans mise gagnante, fenêtre de contestation nulle.
