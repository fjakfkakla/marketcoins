#!/usr/bin/env node
/**
 * Administration des défis on-chain (autorité / résolveur).
 *
 *   node scripts/market.mjs create --id 1 --outcomes 7 --closes 2026-10-27T00:00:00+02:00 --ends 2026-11-02T20:00:00+01:00 [--fee 200] [--dispute 86400] [--resolver <pubkey>]
 *   node scripts/market.mjs show --id 1
 *   node scripts/market.mjs resolve --id 1 --winner 0
 *   node scripts/market.mjs cancel --id 1
 *   node scripts/market.mjs withdraw-fees --id 1
 *   node scripts/market.mjs create-mint                      # mint USDC de test (localnet / devnet)
 *   node scripts/market.mjs mint --to <pubkey> --amount 1000 # crédite des USDC de test
 *   node scripts/market.mjs bet --id 1 --outcome 0 --amount 100   # mise depuis le wallet du script (tests)
 *
 * Variables : SOLANA_RPC (défaut devnet), ANCHOR_WALLET (défaut ~/.config/solana/id.json),
 *             USDC_MINT (défaut USDC devnet), MARKETCOINS_PROGRAM_ID (défaut : adresse de l'IDL).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import anchor from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

const { AnchorProvider, BN, Program, Wallet } = anchor;
const require = createRequire(import.meta.url);
const idl = require("../src/lib/solana/idl/marketcoins.json");

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const WALLET = process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config/solana/id.json");
const USDC_MINT = process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const PROGRAM_ID = new PublicKey(process.env.MARKETCOINS_PROGRAM_ID || idl.address);
const USDC = 1_000_000;

const [cmd, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] ?? "true"] : null)).filter(Boolean));
const need = (k) => {
  if (args[k] === undefined) throw new Error(`--${k} manquant`);
  return args[k];
};

const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET, "utf8"))));
const connection = new Connection(RPC, "confirmed");
const provider = new AnchorProvider(connection, new Wallet(keypair), { commitment: "confirmed" });
const program = new Program({ ...idl, address: PROGRAM_ID.toBase58() }, provider);

const marketPda = (id) => PublicKey.findProgramAddressSync([Buffer.from("market"), new BN(id).toArrayLike(Buffer, "le", 8)], PROGRAM_ID)[0];
const vaultPda = (market) => PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], PROGRAM_ID)[0];
const betPda = (market, bettor, outcome) =>
  PublicKey.findProgramAddressSync([Buffer.from("bet"), market.toBuffer(), bettor.toBuffer(), Buffer.from([outcome])], PROGRAM_ID)[0];
const unix = (s) => {
  const t = Math.floor(new Date(s).getTime() / 1000);
  if (Number.isNaN(t)) throw new Error(`date invalide : ${s}`);
  return t;
};
const fmt = (bn) => (Number(bn.toString()) / USDC).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

async function show(id) {
  const m = await program.account.market.fetch(marketPda(id));
  const status = Object.keys(m.status)[0];
  console.log(`Marché #${id} · ${marketPda(id).toBase58()}`);
  console.log(`  statut ${status}${status === "resolved" ? ` · gagnant #${m.winner} · définitif le ${new Date((m.resolvedAt.toNumber() + m.disputeSeconds.toNumber()) * 1000).toISOString()}` : ""}`);
  console.log(`  mises jusqu'au ${new Date(m.closesAt.toNumber() * 1000).toISOString()} · fin ${new Date(m.endsAt.toNumber() * 1000).toISOString()}`);
  console.log(`  cagnotte ${fmt(m.totalPool)} USDC · volume ${fmt(m.totalVolume)} · frais ${fmt(m.feesAccrued)} (${m.feeBps} bps)`);
  console.log(`  résolveur ${m.resolver.toBase58()} · autorité ${m.authority.toBase58()}`);
  m.pools.slice(0, m.nOutcomes).forEach((p, i) => {
    const sh = m.totalPool.isZero() ? 0 : (Number(p.toString()) / Number(m.totalPool.toString())) * 100;
    console.log(`  #${i}  ${fmt(p).padStart(12)} USDC  ${sh.toFixed(1).padStart(5)} %`);
  });
}

const main = async () => {
  console.log(`RPC ${RPC} · programme ${PROGRAM_ID.toBase58()} · wallet ${keypair.publicKey.toBase58()}`);
  switch (cmd) {
    case "create": {
      const id = Number(need("id"));
      const market = marketPda(id);
      const sig = await program.methods
        .createMarket({
          marketId: new BN(id),
          nOutcomes: Number(need("outcomes")),
          feeBps: Number(args.fee ?? 200),
          closesAt: new BN(unix(need("closes"))),
          endsAt: new BN(unix(need("ends"))),
          disputeSeconds: new BN(Number(args.dispute ?? 86_400)),
          resolver: new PublicKey(args.resolver ?? keypair.publicKey),
        })
        .accountsPartial({ authority: keypair.publicKey, market, mint: new PublicKey(USDC_MINT), vault: vaultPda(market), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .rpc();
      console.log(`créé · ${sig}`);
      await show(id);
      break;
    }
    case "show":
      await show(Number(need("id")));
      break;
    case "resolve": {
      const id = Number(need("id"));
      const sig = await program.methods.resolve(Number(need("winner"))).accountsPartial({ resolver: keypair.publicKey, market: marketPda(id) }).rpc();
      console.log(`résolu · ${sig}`);
      await show(id);
      break;
    }
    case "cancel": {
      const id = Number(need("id"));
      const sig = await program.methods.cancel().accountsPartial({ resolver: keypair.publicKey, market: marketPda(id) }).rpc();
      console.log(`annulé · ${sig}`);
      await show(id);
      break;
    }
    case "withdraw-fees": {
      const id = Number(need("id"));
      const market = marketPda(id);
      const ata = await getOrCreateAssociatedTokenAccount(connection, keypair, new PublicKey(USDC_MINT), keypair.publicKey);
      const sig = await program.methods
        .withdrawFees()
        .accountsPartial({ authority: keypair.publicKey, market, authorityTokenAccount: ata.address, vault: vaultPda(market), tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();
      console.log(`frais retirés · ${sig}`);
      break;
    }
    case "create-mint": {
      const mint = await createMint(connection, keypair, keypair.publicKey, null, 6);
      console.log(`mint USDC de test : ${mint.toBase58()}\nexport USDC_MINT=${mint.toBase58()} NEXT_PUBLIC_USDC_MINT=${mint.toBase58()}`);
      break;
    }
    case "mint": {
      const to = new PublicKey(need("to"));
      const mint = new PublicKey(USDC_MINT);
      const ata = await getOrCreateAssociatedTokenAccount(connection, keypair, mint, to);
      await mintTo(connection, keypair, mint, ata.address, keypair, Math.round(Number(need("amount")) * USDC));
      console.log(`${args.amount} USDC de test envoyés à ${to.toBase58()}`);
      break;
    }
    case "bet": {
      const id = Number(need("id"));
      const outcome = Number(need("outcome"));
      const market = marketPda(id);
      const mint = new PublicKey(USDC_MINT);
      const ata = await getOrCreateAssociatedTokenAccount(connection, keypair, mint, keypair.publicKey);
      const sig = await program.methods
        .placeBet(outcome, new BN(Math.round(Number(need("amount")) * USDC)))
        .accountsPartial({ bettor: keypair.publicKey, market, bet: betPda(market, keypair.publicKey, outcome), bettorTokenAccount: ata.address, vault: vaultPda(market), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .rpc();
      console.log(`mise placée · ${sig}`);
      await show(id);
      break;
    }
    default:
      console.error("commande inconnue. Voir l'en-tête du script.");
      process.exit(1);
  }
};

main().catch((e) => {
  console.error(e.error?.errorMessage ?? e.message ?? e);
  process.exit(1);
});
