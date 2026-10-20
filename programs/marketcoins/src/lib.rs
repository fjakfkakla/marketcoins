//! Marketcoins · programme parimutuel Solana.
//!
//! Un défi = un `Market` avec N résultats (un par KOL) et une cagnotte en USDC
//! dans un compte `vault` détenu par le programme.
//!
//! Cycle de vie :
//! 1. `create_market`  : l'autorité ouvre le défi (résultats, frais, dates, résolveur).
//! 2. `place_bet`      : jusqu'à `closes_at`, n'importe qui mise sur un résultat.
//!                       2 % de frais ; le reste rejoint la cagnotte du résultat.
//!                       Les mises sont définitives : pas de revente.
//! 3. `resolve`        : après `ends_at`, le résolveur (multisig) annonce le gagnant.
//!                       Fenêtre de contestation `dispute_seconds` : il peut corriger
//!                       (`resolve` à nouveau) ou annuler (`cancel`).
//! 4. `claim`          : fenêtre passée, chaque mise gagnante retire
//!                       `stake × cagnotte totale ÷ cagnotte du gagnant`.
//!                       Marché annulé : chaque mise est remboursée intégralement.
//! 5. `withdraw_fees`  : l'autorité retire les frais accumulés, une fois le marché final.
//!
//! Le programme ne promet jamais plus que ce que la cagnotte contient :
//! vault ≥ Σ cagnottes + frais à tout instant.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("7dVSmyCyEK8dQrTiTqtyjLzTbhTwsL7ftRWyYTLkjUiM");

/// Nombre maximal de résultats par marché (7 KOLs aujourd'hui, de la marge).
pub const MAX_OUTCOMES: usize = 16;
/// Frais maximaux autorisés à la création : 10 %.
pub const MAX_FEE_BPS: u16 = 1_000;
/// Fenêtre de contestation maximale : 7 jours.
pub const MAX_DISPUTE_SECONDS: i64 = 7 * 24 * 3600;

#[program]
pub mod marketcoins {
    use super::*;

    pub fn create_market(ctx: Context<CreateMarket>, args: CreateMarketArgs) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(args.n_outcomes >= 2 && (args.n_outcomes as usize) <= MAX_OUTCOMES, MarketError::InvalidOutcomeCount);
        require!(args.fee_bps <= MAX_FEE_BPS, MarketError::FeeTooHigh);
        require!(args.closes_at > now, MarketError::ClosesInPast);
        require!(args.closes_at <= args.ends_at, MarketError::ClosesAfterEnd);
        require!(args.dispute_seconds >= 0 && args.dispute_seconds <= MAX_DISPUTE_SECONDS, MarketError::InvalidDisputeWindow);

        let market = &mut ctx.accounts.market;
        market.market_id = args.market_id;
        market.authority = ctx.accounts.authority.key();
        market.resolver = args.resolver;
        market.mint = ctx.accounts.mint.key();
        market.vault = ctx.accounts.vault.key();
        market.n_outcomes = args.n_outcomes;
        market.fee_bps = args.fee_bps;
        market.closes_at = args.closes_at;
        market.ends_at = args.ends_at;
        market.dispute_seconds = args.dispute_seconds;
        market.status = MarketStatus::Open;
        market.winner = u8::MAX;
        market.resolved_at = 0;
        market.pools = [0; MAX_OUTCOMES];
        market.total_pool = 0;
        market.total_volume = 0;
        market.fees_accrued = 0;
        market.bump = ctx.bumps.market;

        emit!(MarketCreated { market: market.key(), market_id: args.market_id, n_outcomes: args.n_outcomes, closes_at: args.closes_at, ends_at: args.ends_at });
        Ok(())
    }

    /// Mise de `amount` (en unités du mint, 6 décimales pour l'USDC) sur `outcome`.
    /// Plusieurs mises d'un même wallet sur un même résultat s'additionnent.
    pub fn place_bet(ctx: Context<PlaceBet>, outcome: u8, amount: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, MarketError::MarketNotOpen);
        require!(now < market.closes_at, MarketError::BetsClosed);
        require!(outcome < market.n_outcomes, MarketError::InvalidOutcome);
        require!(amount > 0, MarketError::ZeroAmount);

        let fee = (amount as u128 * market.fee_bps as u128 / 10_000) as u64;
        let stake = amount.checked_sub(fee).ok_or(MarketError::Overflow)?;
        require!(stake > 0, MarketError::ZeroAmount);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.bettor_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.bettor.to_account_info(),
                },
            ),
            amount,
        )?;

        let i = outcome as usize;
        market.pools[i] = market.pools[i].checked_add(stake).ok_or(MarketError::Overflow)?;
        market.total_pool = market.total_pool.checked_add(stake).ok_or(MarketError::Overflow)?;
        market.total_volume = market.total_volume.checked_add(amount).ok_or(MarketError::Overflow)?;
        market.fees_accrued = market.fees_accrued.checked_add(fee).ok_or(MarketError::Overflow)?;

        let bet = &mut ctx.accounts.bet;
        if bet.amount == 0 {
            bet.market = market.key();
            bet.bettor = ctx.accounts.bettor.key();
            bet.outcome = outcome;
            bet.bump = ctx.bumps.bet;
        }
        bet.amount = bet.amount.checked_add(amount).ok_or(MarketError::Overflow)?;
        bet.stake = bet.stake.checked_add(stake).ok_or(MarketError::Overflow)?;

        emit!(BetPlaced {
            market: market.key(),
            bettor: ctx.accounts.bettor.key(),
            outcome,
            amount,
            fee,
            stake,
            outcome_pool: market.pools[i],
            total_pool: market.total_pool,
        });
        Ok(())
    }

    /// Annonce (ou corrige, pendant la fenêtre de contestation) le résultat gagnant.
    /// Si personne n'a misé sur le gagnant, le marché est annulé et tout le monde est remboursé.
    pub fn resolve(ctx: Context<Resolve>, winner: u8) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        require!(now >= market.ends_at, MarketError::ChallengeNotOver);
        require!(winner < market.n_outcomes, MarketError::InvalidOutcome);
        match market.status {
            MarketStatus::Open => {}
            MarketStatus::Resolved => require!(!market.is_final(now), MarketError::MarketFinal),
            MarketStatus::Cancelled => return err!(MarketError::MarketCancelled),
        }

        if market.pools[winner as usize] == 0 {
            market.status = MarketStatus::Cancelled;
            market.winner = u8::MAX;
            market.resolved_at = now;
            market.fees_accrued = 0;
            emit!(MarketCancelled { market: market.key(), reason: CancelReason::NoWinningBets });
            return Ok(());
        }

        market.status = MarketStatus::Resolved;
        market.winner = winner;
        market.resolved_at = now;
        emit!(MarketResolved { market: market.key(), winner, resolved_at: now, final_at: now + market.dispute_seconds });
        Ok(())
    }

    /// Annule le marché : toutes les mises deviennent remboursables, frais compris.
    /// Possible tant que le marché est ouvert, ou pendant la fenêtre de contestation.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        match market.status {
            MarketStatus::Open => {}
            MarketStatus::Resolved => require!(!market.is_final(now), MarketError::MarketFinal),
            MarketStatus::Cancelled => return err!(MarketError::MarketCancelled),
        }
        market.status = MarketStatus::Cancelled;
        market.winner = u8::MAX;
        market.resolved_at = now;
        market.fees_accrued = 0;
        emit!(MarketCancelled { market: market.key(), reason: CancelReason::ByResolver });
        Ok(())
    }

    /// Retire le gain d'une mise gagnante (marché final) ou son remboursement (marché annulé).
    /// Le compte de mise est fermé et son loyer rendu au parieur.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let market = &ctx.accounts.market;
        let bet = &ctx.accounts.bet;

        let payout: u64 = match market.status {
            MarketStatus::Cancelled => bet.amount,
            MarketStatus::Resolved => {
                require!(market.is_final(now), MarketError::DisputeWindowOpen);
                require!(bet.outcome == market.winner, MarketError::LosingBet);
                let winner_pool = market.pools[market.winner as usize] as u128;
                // stake × cagnotte totale ÷ cagnotte du gagnant, arrondi vers le bas :
                // la somme des gains ne dépasse jamais la cagnotte.
                (bet.stake as u128 * market.total_pool as u128 / winner_pool) as u64
            }
            MarketStatus::Open => return err!(MarketError::MarketNotResolved),
        };

        let market_id = market.market_id.to_le_bytes();
        let seeds: &[&[u8]] = &[Market::SEED, market_id.as_ref(), &[market.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.bettor_token_account.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                &[seeds],
            ),
            payout,
        )?;

        emit!(Claimed { market: market.key(), bettor: ctx.accounts.bettor.key(), outcome: bet.outcome, stake: bet.stake, payout });
        Ok(())
    }

    /// L'autorité retire les frais, une fois le marché résolu et la contestation close.
    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Resolved && market.is_final(now), MarketError::MarketNotFinal);
        let amount = market.fees_accrued;
        require!(amount > 0, MarketError::NothingToWithdraw);
        market.fees_accrued = 0;

        let market_id = market.market_id.to_le_bytes();
        let bump = market.bump;
        let market_key = market.key();
        let seeds: &[&[u8]] = &[Market::SEED, market_id.as_ref(), &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.authority_token_account.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;
        emit!(FeesWithdrawn { market: market_key, amount });
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateMarketArgs {
    /// Identifiant du défi (le `challenge_no` côté site), unique par programme.
    pub market_id: u64,
    pub n_outcomes: u8,
    /// Frais en points de base : 200 = 2 %.
    pub fee_bps: u16,
    /// Fermeture des mises (timestamp Unix).
    pub closes_at: i64,
    /// Fin du défi : la résolution est possible à partir de là.
    pub ends_at: i64,
    /// Fenêtre de contestation après la résolution (24 h = 86 400).
    pub dispute_seconds: i64,
    /// Clé autorisée à résoudre ou annuler (multisig).
    pub resolver: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: CreateMarketArgs)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [Market::SEED, args.market_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,
    pub mint: Account<'info, Mint>,
    /// Cagnotte en USDC, détenue par le marché (PDA).
    #[account(
        init,
        payer = authority,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = market,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome: u8)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = bettor,
        space = 8 + Bet::INIT_SPACE,
        seeds = [Bet::SEED, market.key().as_ref(), bettor.key().as_ref(), &[outcome]],
        bump,
    )]
    pub bet: Account<'info, Bet>,
    #[account(mut, token::mint = market.mint, token::authority = bettor)]
    pub bettor_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    pub resolver: Signer<'info>,
    #[account(mut, has_one = resolver @ MarketError::Unauthorized)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    pub resolver: Signer<'info>,
    #[account(mut, has_one = resolver @ MarketError::Unauthorized)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,
    #[account(has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        close = bettor,
        has_one = market,
        has_one = bettor,
        seeds = [Bet::SEED, market.key().as_ref(), bettor.key().as_ref(), &[bet.outcome]],
        bump = bet.bump,
    )]
    pub bet: Account<'info, Bet>,
    #[account(mut, token::mint = market.mint, token::authority = bettor)]
    pub bettor_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority @ MarketError::Unauthorized, has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(mut, token::mint = market.mint, token::authority = authority)]
    pub authority_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub market_id: u64,
    pub authority: Pubkey,
    pub resolver: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub n_outcomes: u8,
    pub fee_bps: u16,
    pub closes_at: i64,
    pub ends_at: i64,
    pub dispute_seconds: i64,
    pub status: MarketStatus,
    /// Index du gagnant, `u8::MAX` tant qu'il n'y en a pas.
    pub winner: u8,
    pub resolved_at: i64,
    /// Cagnotte par résultat (mises nettes de frais).
    pub pools: [u64; MAX_OUTCOMES],
    /// Σ pools.
    pub total_pool: u64,
    /// Σ montants bruts misés.
    pub total_volume: u64,
    /// Frais encaissés, encore dans le vault.
    pub fees_accrued: u64,
    pub bump: u8,
}

impl Market {
    pub const SEED: &'static [u8] = b"market";

    /// Résolution définitive : fenêtre de contestation écoulée.
    pub fn is_final(&self, now: i64) -> bool {
        self.status == MarketStatus::Resolved && now >= self.resolved_at + self.dispute_seconds
    }
}

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub outcome: u8,
    /// Montant brut débité.
    pub amount: u64,
    /// Mise nette, entrée dans la cagnotte.
    pub stake: u64,
    pub bump: u8,
}

impl Bet {
    pub const SEED: &'static [u8] = b"bet";
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum MarketStatus {
    Open,
    Resolved,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum CancelReason {
    ByResolver,
    NoWinningBets,
}

// ---------------------------------------------------------------------------
// Événements (pour l'indexeur qui alimente Supabase)
// ---------------------------------------------------------------------------

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub market_id: u64,
    pub n_outcomes: u8,
    pub closes_at: i64,
    pub ends_at: i64,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub outcome: u8,
    pub amount: u64,
    pub fee: u64,
    pub stake: u64,
    pub outcome_pool: u64,
    pub total_pool: u64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub winner: u8,
    pub resolved_at: i64,
    pub final_at: i64,
}

#[event]
pub struct MarketCancelled {
    pub market: Pubkey,
    pub reason: CancelReason,
}

#[event]
pub struct Claimed {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub outcome: u8,
    pub stake: u64,
    pub payout: u64,
}

#[event]
pub struct FeesWithdrawn {
    pub market: Pubkey,
    pub amount: u64,
}

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

#[error_code]
pub enum MarketError {
    #[msg("Entre 2 et 16 résultats")]
    InvalidOutcomeCount,
    #[msg("Frais supérieurs au maximum autorisé")]
    FeeTooHigh,
    #[msg("La fermeture des mises est déjà passée")]
    ClosesInPast,
    #[msg("Les mises doivent fermer avant la fin du défi")]
    ClosesAfterEnd,
    #[msg("Fenêtre de contestation invalide")]
    InvalidDisputeWindow,
    #[msg("Le marché n'est pas ouvert")]
    MarketNotOpen,
    #[msg("Les mises sont fermées")]
    BetsClosed,
    #[msg("Résultat inconnu")]
    InvalidOutcome,
    #[msg("Montant nul")]
    ZeroAmount,
    #[msg("Le défi n'est pas terminé")]
    ChallengeNotOver,
    #[msg("Le marché est déjà définitif")]
    MarketFinal,
    #[msg("Le marché est annulé")]
    MarketCancelled,
    #[msg("Le marché n'est pas résolu")]
    MarketNotResolved,
    #[msg("Le marché n'est pas encore définitif")]
    MarketNotFinal,
    #[msg("Fenêtre de contestation en cours")]
    DisputeWindowOpen,
    #[msg("Mise perdante")]
    LosingBet,
    #[msg("Rien à retirer")]
    NothingToWithdraw,
    #[msg("Non autorisé")]
    Unauthorized,
    #[msg("Dépassement arithmétique")]
    Overflow,
}
