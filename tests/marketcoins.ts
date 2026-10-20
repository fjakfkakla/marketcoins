import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccount, createMint, getAccount, mintTo } from "@solana/spl-token";
import { assert, expect } from "chai";
import type { Marketcoins } from "../target/types/marketcoins";

/** 1 USDC = 1_000_000 unités (6 décimales). */
const USDC = 1_000_000;
const usdc = (n: number) => new BN(Math.round(n * USDC));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("marketcoins · cagnotte parimutuel", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.marketcoins as Program<Marketcoins>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  let mint: PublicKey;
  let authorityAta: PublicKey;
  const alice = Keypair.generate();
  const bob = Keypair.generate();
  const carol = Keypair.generate();
  const stranger = Keypair.generate();
  const ata = new Map<string, PublicKey>();

  const marketPda = (id: number) =>
    PublicKey.findProgramAddressSync([Buffer.from("market"), new BN(id).toArrayLike(Buffer, "le", 8)], program.programId)[0];
  const vaultPda = (market: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], program.programId)[0];
  const betPda = (market: PublicKey, bettor: PublicKey, outcome: number) =>
    PublicKey.findProgramAddressSync([Buffer.from("bet"), market.toBuffer(), bettor.toBuffer(), Buffer.from([outcome])], program.programId)[0];

  /** Heure du validateur (pas celle de la machine) pour caler les dates du marché. */
  const chainNow = async () => (await connection.getBlockTime(await connection.getSlot())) ?? Math.floor(Date.now() / 1000);

  const balance = async (owner: Keypair) => Number((await getAccount(connection, ata.get(owner.publicKey.toBase58())!)).amount) / USDC;
  const vaultBalance = async (market: PublicKey) => Number((await getAccount(connection, vaultPda(market))).amount) / USDC;

  async function createMarket(id: number, opts: { closesIn: number; endsIn: number; dispute: number; nOutcomes?: number; feeBps?: number; resolver?: PublicKey }) {
    const now = await chainNow();
    const market = marketPda(id);
    await program.methods
      .createMarket({
        marketId: new BN(id),
        nOutcomes: opts.nOutcomes ?? 3,
        feeBps: opts.feeBps ?? 200,
        closesAt: new BN(now + opts.closesIn),
        endsAt: new BN(now + opts.endsIn),
        disputeSeconds: new BN(opts.dispute),
        resolver: opts.resolver ?? payer.publicKey,
      })
      .accountsPartial({ authority: payer.publicKey, market, mint, vault: vaultPda(market), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
      .rpc();
    return market;
  }

  const placeBet = (market: PublicKey, bettor: Keypair, outcome: number, amount: number) =>
    program.methods
      .placeBet(outcome, usdc(amount))
      .accountsPartial({
        bettor: bettor.publicKey,
        market,
        bet: betPda(market, bettor.publicKey, outcome),
        bettorTokenAccount: ata.get(bettor.publicKey.toBase58())!,
        vault: vaultPda(market),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([bettor])
      .rpc();

  const claim = (market: PublicKey, bettor: Keypair, outcome: number) =>
    program.methods
      .claim()
      .accountsPartial({
        bettor: bettor.publicKey,
        market,
        bet: betPda(market, bettor.publicKey, outcome),
        bettorTokenAccount: ata.get(bettor.publicKey.toBase58())!,
        vault: vaultPda(market),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bettor])
      .rpc();

  const resolve = (market: PublicKey, winner: number, resolver: Keypair = payer) =>
    program.methods.resolve(winner).accountsPartial({ resolver: resolver.publicKey, market }).signers([resolver]).rpc();

  const cancel = (market: PublicKey, resolver: Keypair = payer) =>
    program.methods.cancel().accountsPartial({ resolver: resolver.publicKey, market }).signers([resolver]).rpc();

  const withdrawFees = (market: PublicKey) =>
    program.methods
      .withdrawFees()
      .accountsPartial({ authority: payer.publicKey, market, authorityTokenAccount: authorityAta, vault: vaultPda(market), tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();

  /** Vérifie qu'une instruction échoue avec le code d'erreur Anchor attendu. */
  async function expectError(p: Promise<unknown>, code: string) {
    try {
      await p;
    } catch (e) {
      const err = e as { error?: { errorCode?: { code?: string } }; message?: string };
      const got = err.error?.errorCode?.code ?? err.message;
      expect(got, `attendu ${code}`).to.include(code);
      return;
    }
    assert.fail(`aurait dû échouer avec ${code}`);
  }

  before(async () => {
    // Faux USDC et 1 000 $ pour chaque parieur.
    mint = await createMint(connection, payer, payer.publicKey, null, 6);
    authorityAta = await createAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
    for (const k of [alice, bob, carol, stranger]) {
      const sig = await connection.requestAirdrop(k.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      const a = await createAssociatedTokenAccount(connection, payer, mint, k.publicKey);
      await mintTo(connection, payer, mint, a, payer, 1000 * USDC);
      ata.set(k.publicKey.toBase58(), a);
    }
  });

  describe("défi résolu normalement", () => {
    let market: PublicKey;

    it("crée le marché avec une cagnotte vide", async () => {
      market = await createMarket(1, { closesIn: 6, endsIn: 6, dispute: 3 });
      const m = await program.account.market.fetch(market);
      expect(m.nOutcomes).to.eq(3);
      expect(m.feeBps).to.eq(200);
      expect(m.totalPool.toNumber()).to.eq(0);
      expect(m.status).to.deep.eq({ open: {} });
      expect(await vaultBalance(market)).to.eq(0);
    });

    it("refuse un marché mal paramétré", async () => {
      await expectError(createMarket(90, { closesIn: 6, endsIn: 6, dispute: 3, nOutcomes: 1 }), "InvalidOutcomeCount");
      await expectError(createMarket(91, { closesIn: 6, endsIn: 6, dispute: 3, feeBps: 5000 }), "FeeTooHigh");
      await expectError(createMarket(92, { closesIn: -10, endsIn: 6, dispute: 3 }), "ClosesInPast");
      await expectError(createMarket(93, { closesIn: 10, endsIn: 6, dispute: 3 }), "ClosesAfterEnd");
    });

    it("encaisse les mises : 2 % de frais, le reste dans la cagnotte du KOL", async () => {
      await placeBet(market, alice, 0, 100);
      await placeBet(market, bob, 1, 300);
      await placeBet(market, carol, 0, 100);
      await placeBet(market, carol, 0, 50); // deux mises de carol sur le même KOL s'additionnent

      const m = await program.account.market.fetch(market);
      expect(m.pools[0].toNumber()).to.eq(245 * USDC); // (100 + 100 + 50) × 0,98
      expect(m.pools[1].toNumber()).to.eq(294 * USDC); // 300 × 0,98
      expect(m.pools[2].toNumber()).to.eq(0);
      expect(m.totalPool.toNumber()).to.eq(539 * USDC);
      expect(m.totalVolume.toNumber()).to.eq(550 * USDC);
      expect(m.feesAccrued.toNumber()).to.eq(11 * USDC);
      expect(await vaultBalance(market)).to.eq(550);
      expect(await balance(alice)).to.eq(900);
      expect(await balance(carol)).to.eq(850);

      const carolBet = await program.account.bet.fetch(betPda(market, carol.publicKey, 0));
      expect(carolBet.amount.toNumber()).to.eq(150 * USDC);
      expect(carolBet.stake.toNumber()).to.eq(147 * USDC);
      expect(carolBet.outcome).to.eq(0);
    });

    it("refuse une mise invalide", async () => {
      await expectError(placeBet(market, alice, 5, 10), "InvalidOutcome");
      await expectError(placeBet(market, alice, 0, 0), "ZeroAmount");
    });

    it("refuse de résoudre avant la fin du défi", async () => {
      await expectError(resolve(market, 0), "ChallengeNotOver");
    });

    it("ferme les mises à l'heure dite", async () => {
      await sleep(7000);
      await expectError(placeBet(market, alice, 0, 10), "BetsClosed");
    });

    it("seul le résolveur peut résoudre", async () => {
      await expectError(resolve(market, 0, stranger), "Unauthorized");
    });

    it("résout, puis corrige pendant la fenêtre de contestation", async () => {
      await resolve(market, 1);
      let m = await program.account.market.fetch(market);
      expect(m.status).to.deep.eq({ resolved: {} });
      expect(m.winner).to.eq(1);

      // Pas de retrait tant que la contestation est ouverte.
      await expectError(claim(market, bob, 1), "DisputeWindowOpen");
      await expectError(withdrawFees(market), "MarketNotFinal");

      // Correction : c'est finalement le KOL 0 qui a gagné.
      await resolve(market, 0);
      m = await program.account.market.fetch(market);
      expect(m.winner).to.eq(0);
    });

    it("paie les gagnants au prorata, les perdants rien, et devient définitif", async () => {
      await sleep(4000);
      await expectError(resolve(market, 1), "MarketFinal");
      await expectError(cancel(market), "MarketFinal");

      // alice : 98 × 539 ÷ 245 = 215,6 · carol : 147 × 539 ÷ 245 = 323,4 · total = 539 = cagnotte
      await claim(market, alice, 0);
      expect(await balance(alice)).to.eq(900 + 215.6);
      await claim(market, carol, 0);
      expect(await balance(carol)).to.eq(850 + 323.4);

      await expectError(claim(market, bob, 1), "LosingBet");
      expect(await balance(bob)).to.eq(700);

      // Le compte de mise est fermé : pas de double retrait.
      await expectError(claim(market, alice, 0), "AccountNotInitialized");

      await withdrawFees(market);
      expect(Number((await getAccount(connection, authorityAta)).amount) / USDC).to.eq(11);
      await expectError(withdrawFees(market), "NothingToWithdraw");

      expect(await vaultBalance(market)).to.eq(0);
    });
  });

  describe("défi annulé par le résolveur", () => {
    let market: PublicKey;

    it("rembourse chaque mise intégralement, frais compris", async () => {
      market = await createMarket(2, { closesIn: 60, endsIn: 60, dispute: 3 });
      await placeBet(market, alice, 0, 40);
      await placeBet(market, bob, 2, 10);

      await expectError(cancel(market, stranger), "Unauthorized");
      await cancel(market);
      const m = await program.account.market.fetch(market);
      expect(m.status).to.deep.eq({ cancelled: {} });
      expect(m.feesAccrued.toNumber()).to.eq(0);

      await expectError(placeBet(market, carol, 0, 10), "MarketNotOpen");
      await expectError(withdrawFees(market), "MarketNotFinal");

      const a0 = await balance(alice);
      const b0 = await balance(bob);
      await claim(market, alice, 0);
      await claim(market, bob, 2);
      expect(await balance(alice)).to.eq(a0 + 40);
      expect(await balance(bob)).to.eq(b0 + 10);
      expect(await vaultBalance(market)).to.eq(0);
    });
  });

  describe("gagnant sans aucune mise", () => {
    it("annule le marché et rembourse", async () => {
      const market = await createMarket(3, { closesIn: 3, endsIn: 3, dispute: 0 });
      await placeBet(market, carol, 0, 25);
      const c0 = await balance(carol);
      await sleep(4000);

      await resolve(market, 2); // personne n'a misé sur le KOL 2
      const m = await program.account.market.fetch(market);
      expect(m.status).to.deep.eq({ cancelled: {} });

      await claim(market, carol, 0);
      expect(await balance(carol)).to.eq(c0 + 25);
      expect(await vaultBalance(market)).to.eq(0);
    });
  });

  describe("sans contestation", () => {
    it("retrait possible dès la résolution quand la fenêtre est nulle", async () => {
      const market = await createMarket(4, { closesIn: 3, endsIn: 3, dispute: 0 });
      await placeBet(market, alice, 1, 10);
      await placeBet(market, bob, 0, 30);
      const a0 = await balance(alice);
      await sleep(4000);
      await resolve(market, 1);
      await claim(market, alice, 1);
      // 9,8 × 39,2 ÷ 9,8 = toute la cagnotte
      expect(await balance(alice)).to.eq(a0 + 39.2);
      await withdrawFees(market);
      expect(await vaultBalance(market)).to.eq(0);
    });
  });
});
