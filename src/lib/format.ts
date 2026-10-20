export const usd = (n: number, opts: { compact?: boolean; sign?: boolean } = {}) => {
  const { compact = false, sign = false } = opts;
  const abs = Math.abs(n);
  let body: string;
  if (compact && abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  else if (compact && abs >= 1000) body = `${(abs / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  else body = abs.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const prefix = n < 0 ? "−" : sign ? "+" : "";
  return `${prefix}$${body}`;
};

export const pct = (p: number) => `${Math.round(p * 100)}%`;
export const cents = (p: number) => `${Math.round(p * 100)}¢`;

/** Multiplicateur de gain : x1,8 · x12 · « — » si personne n'a encore misé. */
export const mult = (x: number) => {
  if (!Number.isFinite(x) || x <= 0) return "—";
  const digits = x >= 10 ? 0 : x >= 3 ? 1 : 2;
  return `x${x.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

export const shortWallet = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

export const dateFr = (iso: string, opts: Intl.DateTimeFormatOptions = {}) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
    ...opts,
  });
