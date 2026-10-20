import "server-only";
import { createHmac, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify } from "node:crypto";
import bs58 from "bs58";
import { NextResponse } from "next/server";
import { CLUSTER } from "./cluster";
import { supabaseAdmin } from "./supabase";

/**
 * Connexion par signature (format « Sign In With Solana »).
 *
 * 1. /api/auth/nonce  : le serveur prépare un message unique, le garde dans un cookie signé.
 * 2. Le wallet (Phantom, Solflare, Backpack…) signe ce message. Gratuit, aucune transaction.
 * 3. /api/auth/verify : le serveur reconstruit le message, vérifie la signature ed25519,
 *    crée le compte s'il n'existe pas et ouvre une session.
 *
 * Aucune clé privée ne passe par ici : on ne voit que l'adresse publique et la signature.
 */

export const SESSION_COOKIE = "mc_session";
export const NONCE_COOKIE = "mc_siws";
const SESSION_TTL_S = 7 * 24 * 3600;
export const NONCE_TTL_S = 5 * 60;


// Format imposé par Sign In With Solana (Phantom refuse d'afficher le message sinon) :
// lettres sans accent, chiffres, espaces et ponctuation simple uniquement, sur une seule ligne.
const STATEMENT = "Connexion sur Marketcoins. Signature gratuite : ce n'est pas une transaction, aucun fonds ne bouge.";

// ---------------------------------------------------------------
// Jetons signés (HMAC) : cookie de nonce et cookie de session
// ---------------------------------------------------------------

let devSecret: string | null = null;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum)");
  if (!devSecret) {
    devSecret = randomBytes(32).toString("hex");
    console.warn("[auth] SESSION_SECRET absent : secret temporaire, les sessions sautent au redémarrage (dev uniquement)");
  }
  return devSecret;
}

const mac = (purpose: string, body: string) => createHmac("sha256", secret()).update(`${purpose}.${body}`).digest();

export function seal(purpose: string, payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(purpose, body).toString("base64url")}`;
}

export function unseal<T>(purpose: string, token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const given = Buffer.from(sig, "base64url");
  const expected = mac(purpose, body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------
// Adresse, message, signature
// ---------------------------------------------------------------

export function isSolanaAddress(address: unknown): address is string {
  if (typeof address !== "string" || address.length < 32 || address.length > 44) return false;
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

export type SiwsFields = {
  domain: string;
  address: string;
  uri: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

export function newSiwsFields(site: URL, address: string): SiwsFields {
  const now = Date.now();
  return {
    domain: site.host,
    address,
    uri: site.origin,
    chainId: CLUSTER,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: new Date(now).toISOString(),
    expirationTime: new Date(now + NONCE_TTL_S * 1000).toISOString(),
  };
}

/** Message au format SIWS : les wallets reconnaissent le domaine et alertent en cas de site imitateur. */
export function siwsMessage(f: SiwsFields): string {
  return [
    `${f.domain} wants you to sign in with your Solana account:`,
    f.address,
    "",
    STATEMENT,
    "",
    `URI: ${f.uri}`,
    "Version: 1",
    `Chain ID: ${f.chainId}`,
    `Nonce: ${f.nonce}`,
    `Issued At: ${f.issuedAt}`,
    `Expiration Time: ${f.expirationTime}`,
  ].join("\n");
}

export function verifySignature(address: string, message: string, signature: Uint8Array): boolean {
  if (signature.length !== 64) return false;
  try {
    const x = Buffer.from(bs58.decode(address)).toString("base64url");
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x }, format: "jwk" });
    return verify(null, Buffer.from(message, "utf8"), key, signature);
  } catch {
    return false;
  }
}

export const sealNonce = (f: SiwsFields) => seal("siws", f);

export function openNonce(token: string | undefined): SiwsFields | null {
  const f = unseal<SiwsFields>("siws", token);
  return f && Date.parse(f.expirationTime) > Date.now() ? f : null;
}

// ---------------------------------------------------------------
// Origine du site
// ---------------------------------------------------------------

/** Origines autorisées : APP_URL (plusieurs possibles, séparées par des virgules) et le domaine fourni par Railway. */
export function allowedOrigins(): string[] {
  const hosts = [process.env.RAILWAY_PUBLIC_DOMAIN].filter(Boolean).map((h) => `https://${h}`);
  const app = (process.env.APP_URL ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  return [...app, ...hosts].flatMap((u) => {
    try {
      return [new URL(u).origin];
    } catch {
      return [];
    }
  });
}

/**
 * Adresse du site pour cette requête, ou null si la requête vient d'ailleurs (CSRF, site imitateur).
 * En production, on accepte les origines configurées, et sur Railway l'adresse par laquelle la requête
 * est arrivée : l'hébergeur ne fait parvenir au site que les domaines rattachés au service
 * (*.up.railway.app, domaine perso). Ailleurs, on ne se fie jamais à l'en-tête Host : un site
 * imitateur pourrait sinon faire signer un message à son propre nom.
 */
export const managedHost = (): "railway" | null => (process.env.RAILWAY_ENVIRONMENT_ID ? "railway" : null);

export function siteUrl(req: Request): URL | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (allowedOrigins().includes(origin)) return new URL(origin);
  // Seulement l'en-tête Host (jamais X-Forwarded-Host, qu'un intermédiaire peut inventer) :
  // pour que l'hébergeur route la requête jusqu'ici, il doit valoir un des domaines du projet.
  const host = req.headers.get("host");
  if (managedHost() && host && origin === `https://${host}`) return new URL(origin);
  if (process.env.NODE_ENV !== "production") {
    const local = new URL(req.url).origin; // dev
    if (origin === local) return new URL(local);
  }
  console.error(`[auth] origine refusée : ${origin} (autorisées : ${allowedOrigins().join(", ") || "aucune, définir APP_URL"})`);
  return null;
}

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export const cookieBase = (site: URL) => ({ httpOnly: true, secure: site.protocol === "https:" });

// ---------------------------------------------------------------
// Comptes et sessions
// ---------------------------------------------------------------

type SessionPayload = { sid: string; addr: string; app: string | null; exp: number };

export type Session = { address: string; walletApp: string | null; accountId: string | null };

export const SESSION_MAX_AGE = SESSION_TTL_S;

/**
 * Crée le compte au premier passage, puis une session.
 * Avec Supabase, la session est enregistrée en base (révocable) et le nonce ne peut servir qu'une fois.
 * Sans Supabase (dev / démo), la session tient seulement dans le cookie signé.
 */
export async function createSession(f: SiwsFields, walletApp: string | null, userAgent: string | null) {
  const sid = randomUUID();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const db = supabaseAdmin();
  if (db) {
    const account = await db
      .from("accounts")
      .upsert({ wallet: f.address, wallet_app: walletApp, last_login_at: new Date().toISOString() }, { onConflict: "wallet" })
      .select("id")
      .single();
    if (account.error) throw new Error(`accounts : ${account.error.message}`);
    const session = await db.from("sessions").insert({
      id: sid,
      account_id: account.data.id,
      nonce: f.nonce,
      expires_at: new Date(exp * 1000).toISOString(),
      user_agent: userAgent?.slice(0, 300) ?? null,
    });
    // 23505 = nonce déjà utilisé : quelqu'un rejoue une ancienne signature.
    if (session.error?.code === "23505") return null;
    if (session.error) throw new Error(`sessions : ${session.error.message}`);
  }
  return seal("session", { sid, addr: f.address, app: walletApp, exp } satisfies SessionPayload);
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  const p = unseal<SessionPayload>("session", token);
  if (!p || p.exp * 1000 < Date.now()) return null;
  const db = supabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("sessions")
      .select("account_id, revoked_at, expires_at, accounts!inner(wallet)")
      .eq("id", p.sid)
      .maybeSingle();
    if (error) {
      console.error("[auth] lecture session :", error.message);
      return null;
    }
    const wallet = (data?.accounts as unknown as { wallet: string } | null)?.wallet;
    if (!data || data.revoked_at || Date.parse(data.expires_at) < Date.now() || wallet !== p.addr) return null;
    return { address: p.addr, walletApp: p.app, accountId: data.account_id as string };
  }
  return { address: p.addr, walletApp: p.app, accountId: null };
}

export async function revokeSession(token: string | undefined) {
  const p = unseal<SessionPayload>("session", token);
  const db = supabaseAdmin();
  if (!p || !db) return;
  const { error } = await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("id", p.sid);
  if (error) console.error("[auth] révocation session :", error.message);
}
