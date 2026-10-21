@AGENTS.md

# Marketcoins : consignes de travail

> **RÈGLE N°1 : toujours pousser sur `main`.** `main` est la prod. Au début d'une tâche,
> partir du `main` à jour (`git fetch origin main`), jamais d'une vieille branche.
> À la fin : `git push origin HEAD:main` (plus la branche de travail s'il y en a une).
> Pas de PR, pas besoin de demander : une tâche n'est pas finie tant qu'elle n'est pas sur `main`.

Marché de prédiction memecoins (KOLs et coins), USDC sur Solana, 0 % de frais.
Next.js 16 (App Router), Tailwind v4, Supabase, Solana. On répond et on commit en français.

**Hébergement : Railway, et rien d'autre.** Prod : https://marketcoins.up.railway.app (service `kolmarket`).
Toutes les variables vivent dans Railway → service → Variables
(un changement redéploie tout seul). Pas de Vercel, pas de `vercel.json`, pas de variable à répéter ailleurs.
Ne jamais réintroduire un deuxième hébergeur ni une doc qui dit de configurer deux endroits.

## À la fin de chaque tâche

1. `npm run typecheck` et `npx eslint src` doivent passer.
2. Commit, puis **push sur `main`** (en plus de la branche de travail s'il y en a une).
   `main` est ce qui part en prod ; une tâche n'est pas finie tant qu'elle n'y est pas.
3. Si la tâche ajoute ou modifie un fichier dans `supabase/` (migration ou seed) :
   donner dans la réponse **le SQL complet, prêt à copier-coller** dans l'éditeur SQL
   de Supabase, un bloc par fichier, dans l'ordre où il faut les lancer.
   Sinon, dire en une ligne qu'il n'y a rien à lancer côté Supabase.

## Direction artistique

- Ne pas ressembler à web33 / memescanner (gros titre centré sur aplat bleu, Bricolage,
  pilules brillantes, logo carré). Les retouches de DA restent **mesurées** : on change
  ce qui est demandé, on ne refait pas tout (palette, polices, pied) sans qu'on le demande.
- Bleu : `#1652F0` (`--color-blue` dans `src/app/globals.css`), nuances dérivées.
- Polices : Sora pour les titres (`display`, `font-display`), Inter pour le texte.
- Boutons : aplat sur une tranche plus sombre qui s'enfonce au clic (`.plaque`, `.pill-white`).
- Logo : pièce ronde avec flèche montante, wordmark « marketcoins » en minuscules (`Logo.tsx`).
- Planche (`.planche`) : ciel de nuit étoilé, la planète bleue apporte la couleur.
- Hero de la landing : titre à gauche, planète à droite (desktop).
- Pas de pied de page dans l'app (`src/app/(app)`) ; le pied est réservé à la landing.

## Tokens et logos

- Toujours les **vrais logos** des tokens, jamais de logo généré ou inventé.
  Ils sont dans `public/coins/<ticker>.webp` (160×160), pris depuis les métadonnées
  on-chain via `https://lite-api.jup.ag/tokens/v2/search?query=<TICKER>` (garder le token
  `isVerified`, noter son `mint`). Si l'URL IPFS ne répond pas, passer par
  `https://gateway.pinata.cloud/ipfs/<cid>`.
- Dans `src/data/coins.ts`, chaque coin a `logo` et `mint` ; `mark` ne sert que sans logo.
