# Marketcoins

Paris en pot commun sur les KOLs crypto. « Quel KOL fera le plus de profit sur 7 jours ? »

## Fonctionnement

- **Connexion** : n'importe quel wallet Solana (Phantom, Solflare, Backpack… via le Wallet Standard). Le joueur signe un message gratuit, le serveur vérifie la signature et crée le compte. Aucune clé privée ne transite.
- **Pot commun, 0 frais** : toutes les mises d'un marché forment un pot. Ceux qui ont misé sur le KOL gagnant se partagent 100 % du pot au prorata de leur mise. Personne sur le gagnant ou marché annulé : tout le monde est remboursé. La plateforme ne prend aucun risque et n'avance aucun argent.
- **Le % affiché** = part du pot misée sur le KOL. **Cote** = pot ÷ montant misé sur le KOL. Le gain reste une estimation jusqu'à la fermeture des mises (au début du défi). Pas de revente.
- **Plafonds** (`src/lib/limits.ts`) : dépôts jusqu'à 1000 $ sur le compte (solde + mises en cours), 1000 $ max par compte et par marché, retrait minimum 5 $. Les gains au-delà de 1000 $ se gardent. Un dépôt envoyé directement au coffre au-delà du plafond est mis de côté (« à retirer ») : il n'est pas jouable.
- **Registre** : chaque mouvement (dépôt, mise, gain, retrait) est une ligne en micro-USDC, jamais modifiée ni effacée. Le solde est la somme des lignes. Toutes les écritures passent par des fonctions SQL sous verrou (pas de double crédit, pas de solde négatif, même avec des requêtes simultanées).
- **Dépôts** : le site prépare la transaction USDC (wallet du joueur → coffre), la plateforme la signe comme payeuse des frais (0 frais pour le joueur), le joueur la signe dans son wallet, le serveur l'envoie. Le crédit n'a lieu que lorsque la transaction est définitive (« finalized »), lue directement sur la chaîne.
- **Retraits** : uniquement vers le wallet du compte, 5 $ minimum, 0 frais. Le compte est débité tout de suite, puis les USDC partent du **wallet chaud** (le même que le payeur des frais), qui garde une petite réserve. Le coffre ne sert qu'à recevoir : sa clé n'est jamais sur le serveur. La signature de chaque envoi est enregistrée avant l'envoi, et une transaction n'est refaite que si la précédente a été refusée, a échoué ou a expiré sans arriver : jamais de double paiement. Avant chaque envoi, on vérifie que coffre + réserve couvrent ce que la plateforme doit.
- **Garde-fous des retraits** (`src/lib/limits.ts`) : au-delà de 2000 $ par retrait, ou de 10 000 $ retirés sur 24 h pour toute la plateforme, le retrait attend une validation manuelle.
- **Défis** (`src/lib/challenge-calendar.ts`) : un défi 7 jours chaque semaine (lundi 00:00 → dimanche 23:59 UTC) et un défi par mois calendaire. Chacun est créé automatiquement dès que le précédent démarre, avec tous les KOLs actifs ; ses mises sont ouvertes jusqu'à son départ.
- **PnL des KOLs** : Solana Tracker (PnL V2), PnL réalisé jour par jour du wallet principal, en journées UTC. Synchro toutes les 3 h (~1 700 requêtes par mois pour 7 KOLs : offre gratuite).
- **Résultat** : 12 h après la fin (vers 12:00 UTC le lendemain), le PnL de chaque KOL sur la période est relu, contrôlé (somme des journées = total de la source) et publié ; le gagnant est proposé. 24 h plus tard, le pot est payé automatiquement, au micro-USDC près (méthode du plus grand reste). Égalité → annulé et remboursé. Données manquantes ou incohérentes → nouvel essai chaque heure, puis annulation et remboursement 72 h après la fin.
- **Relecture avant paiement** : juste avant de payer, le PnL de chaque KOL est relu. Gagnant changé ou chiffre qui a bougé (plus de 1 $ et 0,1 %) → rien n'est payé, le résultat est republié et les 24 h repartent. Source indisponible → nouvel essai dans l'heure. Après 3 republications, la décision revient à l'admin. Un gagnant choisi dans `/admin` est payé sans relecture.
- **Administration** (`/admin`) : réservée aux wallets de `ADMIN_WALLETS`. Chaque action est signée par le wallet admin (message lisible + empreinte SHA-256 de l'action, nonce à usage unique, 10 min de validité) et inscrite au journal `admin_actions`.

**État actuel** :
- Avec Supabase : connexion, solde, dépôts, retraits USDC (devnet), mises, résultats et paiement des pots sont réels.
- Sans Supabase (dev local) : connexion réelle, mais solde et mises en démo dans le navigateur.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
```

Autres commandes : `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`, `npm run test:program`
(tests du programme Solana non-custodial dans `programs/marketcoins/`, pas encore branché au site : voir son README).

## Lancement public (chrono)

Avant l'ouverture, **seule la landing (`/`) répond** : toute autre adresse (app, marchés, compte, `/admin`, `/api/*`…)
renvoie vers `/` (404 pour une API). Personne n'entre, admin compris. La landing n'a plus aucun lien vers l'app
et chaque lien vers l'app ouvre « Access opens in: » et le chrono en plein écran, sur la landing même. Voir `src/proxy.ts` et `src/lib/launch.ts`.

Le chrono est lancé : l'heure de départ est écrite en dur dans `src/lib/launch.ts` (`LAUNCH_START`,
2026-10-14T19:00:26Z) et l'accès ouvre 7 jours plus tard. Pour la changer : modifier la date et pousser sur `main`.

**CA du coin** : écrit en dur dans `src/lib/ca.ts`. Il s'affiche dans une fenêtre flottante « Contract address »
en haut à droite (landing et app ; en bas à droite sur mobile), avec un bouton Copier ; la croix la replie en pastille « CA ».

## Pages

| Route | Contenu |
|---|---|
| `/` | **Landing** : héros 3D (planète WebGL + KOLs et memecoins en orbite), « Trade the KOL » et « Trade the potential of your favorite coin » (les vrais écrans de l'app joués au défilement), 0 % de frais, bouton « Lancer l'application » |
| `/app` | L'application : défi en vedette, filtres (KOL, Memecoins, 7 j, 30 j), défis KOL, marchés memecoins, marchés Oui / Non |
| `/market/premier-500m-mcap` | Marché memecoin « Premier à toucher 500 M$ de market cap » : aperçu en pot commun (données mock, mises réelles pas encore ouvertes) |
| `/market/kol-7d-2026-10-12` | Page d'un défi : course au PnL, % du pot et cote par KOL, panneau de mise, classement du défi puis résultat, répartition du pot, activité, règles, wallets |
| `/market/kol-top-profit-7d` | Redirige vers le défi 7 jours où l'on peut miser (même chose avec `-30d`) |
| `/account` | Compte : solde, dépôt / retrait USDC, mises en cours et gain estimé, mises terminées, historique |
| `/admin` | Administration : lancer un défi, ajouter ou retirer un KOL, lire / corriger un résultat, payer, annuler, journal |
| `/how-it-works` | Explication du fonctionnement |
| `/terms` | Conditions d'utilisation |

## Direction artistique

La DA du projet memescanner (papier clair, objets imprimés, Bricolage pour ce qui est gros, Inter
pour le reste, aucune mono), au bleu Polymarket `#2e5cff`. Jetons et objets dans
`src/app/globals.css` (plaque, pilule blanche, planche, pièce, verre, aura). Polices servies en
local depuis `src/app/fonts/`.

La landing (`src/app/(landing)/`, composants `src/components/landing/`) n'utilise aucune
bibliothèque d'animation : chaque scène est une piste collée dont la progression se lit sur son
rectangle (`landing/scroll.ts`) ; la planète est un seul shader WebGL (`landing/Planet.tsx`) avec
un repli CSS. Rien ne tourne hors écran ; en mouvement réduit, tout est posé.

## Structure

```
src/data/kols.ts            les 7 KOLs (nom, handle X, wallet Solana, PnL mock, séries)
src/data/markets.ts         les marchés et la répartition mock du pot
src/lib/auth.ts             connexion par signature (SIWS), sessions, comptes (serveur)
src/app/api/auth/           nonce → verify → session (GET / DELETE)
src/lib/solana-wallets.ts   détection des wallets (Wallet Standard) et signature côté navigateur
src/lib/wallet.tsx          état du compte côté navigateur (réel via /api/account, ou démo)
src/lib/solana.ts           Solana côté serveur : RPC Alchemy, transaction de dépôt, lecture des transactions du coffre
src/lib/deposits.ts         détection et crédit des dépôts, synchro du coffre, contrôle coffre ≥ engagements
src/lib/withdrawals.ts      retraits : demande, envoi, rapprochement avec la chaîne
src/lib/account.ts          solde, mises et historique ; placement d'une mise
src/app/api/withdraw/       demande de retrait ; status (suivi)
src/app/api/health/         diagnostic de la configuration (aucun secret affiché)
src/app/api/account/        compte du joueur connecté
src/app/api/deposit/        prepare → submit → status ; info (adresses publiques du coffre)
src/app/api/bets/           placer une mise
src/app/api/webhooks/alchemy/  webhook Alchemy (signal, signé HMAC)
src/lib/challenge-calendar.ts  calendrier et textes des défis (journées UTC), étapes d'un défi
src/lib/challenges.ts       création des défis, lecture du résultat, paiement des pots
src/lib/solanatracker.ts    client Solana Tracker (PnL V2)
src/lib/kol-pnl.ts          synchro du PnL des KOLs (pnl_snapshots, kol_stats)
src/lib/jobs.ts             toutes les tâches planifiées, dans l'ordre
src/instrumentation.ts      démarre le planificateur intégré (toutes les 10 min) sur Railway
src/lib/admin*.ts           administration : accès, message signé, actions, données de la page
src/app/api/admin/          action signée ; vérification d'un wallet chez Solana Tracker
src/app/api/cron/sync/      lance les tâches planifiées à la demande (Bearer CRON_SECRET)
src/lib/limits.ts           plafonds (1000 $, mise max, retrait min)
src/lib/pot.ts              calculs du pot commun (cote, gain estimé)
src/components/             Nav, cartes, graphique PnL, panneau de mise, modales, podium…
src/app/                    pages (App Router, Next 16)
public/kols/            avatars des KOLs
```

## Base de données (Supabase)

1. Supabase → SQL Editor → coller et exécuter `supabase/migrations/0001_init.sql`.
2. Puis `supabase/seed/0001_kols_and_markets.sql` (7 KOLs, stats et PnL de démonstration, remplacés par les vrais à la première synchro). Les défis sont créés par le serveur.
3. Puis `supabase/migrations/0002_accounts.sql` (comptes et sessions). **Obligatoire pour la connexion** dès que Supabase est configuré.
4. Puis `supabase/migrations/0003_ledger.sql` (registre, dépôts, mises, contrôle du coffre). **Obligatoire pour les dépôts et les mises.**
5. Puis `supabase/migrations/0004_withdrawals.sql` (retraits). **Obligatoire pour les retraits.**
6. Puis `supabase/migrations/0005_challenges.sql` (résultats, paiement des pots, remboursements ; recale les deux premiers défis sur le calendrier UTC). **Obligatoire pour les défis.**
7. Puis `supabase/migrations/0006_admin.sql` (journal des actions admin, origine du résultat). **Obligatoire pour /admin et la relecture.**
8. Puis `supabase/migrations/0007_zeropnl_avatar.sql` (photo de profil de zeropnl sur une base déjà seedée).
8. Tous les scripts sont rejouables sans danger.

Tables : `kols`, `kol_stats`, `pnl_snapshots`, `markets`, `outcomes`, `market_results` (PnL final de chaque KOL, public), `accounts`, `sessions`, `vault_signatures`, `ledger_entries`, `bets`, `withdrawals`, `solvency_checks`, `app_state` (+ `trades`, `positions` de l'ancien modèle Oui/Non, plus utilisées).
Vues publiques : `market_stats` (pot, joueurs), `outcome_pools` (pot par KOL), `recent_bets` (dernières mises, adresse raccourcie), `kol_pnl_series`.
RLS : lecture publique des données de marché et des agrégats, aucune écriture côté client. Comptes, sessions, registre et mises sont invisibles pour `anon`, et les fonctions d'argent (`credit_deposit`, `place_bet`…) ne sont appelables que par le serveur (service_role).
Les pots se remplissent avec les vraies mises : le seed n'en crée plus.

## Prochaines étapes

1. ~~Connexion multi-wallets et comptes~~ (fait).
2. ~~Registre, dépôts (devnet) et mises~~ (fait).
3. ~~Retraits~~ (fait).
4. ~~PnL des KOLs (Solana Tracker)~~ (fait).
5. ~~Résultats, paiement des pots, remboursements~~ (fait).
6. **Avant le vrai argent** : avis d'avocat, coffre multisig (Squads), 2 à 3 semaines de défis sur devnet sans erreur.

## Variables d'environnement

À définir dans Railway (service → Variables). Voir `.env.example`.
Le site est déployé par Railway à partir de la branche `main`.

| Variable | Où la trouver | Exposée au navigateur ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | **non, serveur uniquement** |
| `SESSION_SECRET` | à générer : `openssl rand -hex 32` (64 caractères) | **non, serveur uniquement** |
| `APP_URL` | adresse(s) publique(s) du site, ex. `https://marketcoins.app,https://www.marketcoins.app` | non |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` (défaut) ou `mainnet` | oui |

- `SESSION_SECRET` est **obligatoire en production** : sans lui, la connexion est refusée.
- `APP_URL` : les adresses que les joueurs utilisent. L'adresse est écrite dans le message signé, et les requêtes venues d'une autre adresse sont refusées. Les domaines fournis automatiquement par Vercel (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`, `VERCEL_BRANCH_URL`) et Railway (`RAILWAY_PUBLIC_DOMAIN`) sont acceptés d'office. Si ton domaine perso a plusieurs variantes (avec et sans `www`), mets-les toutes dans `APP_URL`.
- Sans les variables Supabase, le site fonctionne avec les données mock et la session tient seulement dans le cookie signé.

### Dépôts USDC

| Variable | Contenu | Exposée au navigateur ? |
|---|---|---|
| `ALCHEMY_API` | clé API Alchemy (app Solana, Node API + Webhooks) | **non** |
| `VAULT_ADDRESS` | adresse publique du coffre qui reçoit les dépôts | non |
| `FEE_PAYER_SECRET_KEY` | clé privée du petit wallet qui paie les frais réseau (base58, format export Phantom) | **non, secret** |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | « Signing key » du webhook Alchemy | **non, secret** |
| `CRON_SECRET` | facultatif : `openssl rand -hex 16`, pour lancer les tâches à la main via `/api/cron/sync` | **non, secret** |

Sans `ALCHEMY_API`, `VAULT_ADDRESS` et `FEE_PAYER_SECRET_KEY`, le bouton Déposer affiche « pas encore ouverts ».

**Mise en route sur devnet**
1. Dans Phantom, crée deux comptes : « Coffre devnet » et « Frais devnet ». Copie l'adresse du coffre dans `VAULT_ADDRESS`, exporte la clé privée du compte frais dans `FEE_PAYER_SECRET_KEY`. Garde la clé du coffre à part : elle servira aux retraits.
2. Envoie quelques SOL de test au compte frais : https://faucet.solana.com (réseau devnet).
3. Prends des USDC de test pour ton wallet joueur : https://faucet.circle.com (Solana Devnet).
4. Ouvre `https://<ton-site>/api/deposit/info` et copie `vaultUsdcAccount` (le compte USDC du coffre, c'est lui qui reçoit les dépôts). Puis Alchemy → Webhooks → Address Activity, réseau Solana Devnet, adresse = `vaultUsdcAccount`, URL = `https://<ton-site>/api/webhooks/alchemy`. Copie la « Signing key » dans `ALCHEMY_WEBHOOK_SIGNING_KEY`.
   Sans webhook, les dépôts faits avec le bouton sont quand même crédités (le navigateur suit la transaction) ; le webhook sert pour les envois directs au coffre.
5. Pour voir tes USDC de test dans Phantom : Paramètres → Paramètres développeur → Mode testnet → Solana Devnet.

Le wallet chaud (payeur des frais + réserve des retraits) ne détient que quelques SOL et une petite réserve d'USDC : s'il est compromis, la perte est limitée à ça. Les USDC des joueurs sont sur le coffre, dont la clé n'est jamais sur le serveur.

### Retraits : exploitation

- **Recharger la réserve** : envoie des USDC du coffre vers l'adresse `payeur_des_frais` affichée sur `/api/health` (ligne `reserve_retraits_USDC`). Sur devnet, tu peux aussi l'alimenter directement avec le faucet Circle. Tant que la réserve est vide, les retraits restent « en attente » et repartent tout seuls dès qu'elle est rechargée (à la visite du joueur ou par la tâche planifiée).
- **Valider un retrait en vérification** (Supabase → SQL Editor) : `update withdrawals set status = 'QUEUED' where id = '…';`
- **Refuser un retrait en vérification** (le joueur est recrédité) : `select refund_withdrawal('…', 'raison');`
- **Voir les retraits en cours** : `select id, destination, amount_micro / 1e6 as usdc, status, last_error from withdrawals where status <> 'CONFIRMED' order by created_at;`

### Défis : exploitation

| Variable | Contenu | Exposée au navigateur ? |
|---|---|---|
| `SOLANATRACKER_API_KEY` | clé API gratuite : solanatracker.io → Data API | **non, secret** |
| `SCHEDULER` | `on` / `off`. Par défaut `on` sur Railway : les tâches tournent toutes les 10 minutes dans le serveur, sans service en plus | non |
| `ADMIN_WALLETS` | adresse(s) des wallets admin, séparées par des virgules | non |

Sans `SOLANATRACKER_API_KEY`, les défis sont créés mais le PnL et les résultats restent en pause (voir `/api/health`, section `defis`).

Le plus simple : `/admin`, connecté avec le wallet admin. Chaque bouton ouvre ton wallet pour signer.

En secours, dans Supabase → SQL Editor. Pendant les 24 h qui suivent la proposition :
- **Voir le résultat proposé** : `select slug, status, resolution_note, proposed_at from markets where status = 'PROPOSED';` et `select * from market_results where market_id = '…' order by realized_pnl_usd desc;`
- **Corriger le gagnant** (relance les 24 h ; `manual` évite que la relecture le remplace par les chiffres) : `select propose_result('<id du marché>', '<id du KOL>', 'raison'); update markets set result_source = 'manual' where id = '<id du marché>';`
- **Annuler et rembourser tout le monde** : `select cancel_market('<id du marché>', 'raison affichée aux joueurs');`
- **Payer sans attendre** (après vérification) : `select settle_market('<id du marché>', '0 seconds');`
- **Retirer un KOL des prochains défis** : `update kols set active = false where id = '…';` (les défis déjà ouverts le gardent).
