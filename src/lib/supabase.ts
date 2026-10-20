import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clients Supabase. Les variables viennent de l'environnement (Railway),
 * jamais du code. Si elles sont absentes, le site tourne sur les données mock.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

/** Client public (navigateur + serveur), limité par les RLS. */
export function supabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

/** Client admin, serveur uniquement (cron, résolution). Ne jamais importer côté client. */
export function supabaseAdmin(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof window !== "undefined") throw new Error("supabaseAdmin ne doit pas être appelé côté client");
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
