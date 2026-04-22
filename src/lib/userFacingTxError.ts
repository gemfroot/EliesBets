import { chainName } from "@/lib/chains";

type ErrLike = {
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  reason?: unknown;
  cause?: unknown;
  code?: unknown;
  metaMessages?: unknown;
  data?: unknown;
  docsPath?: unknown;
  version?: unknown;
};

function pushStr(parts: string[], v: unknown) {
  if (typeof v === "string" && v.trim()) parts.push(v.trim());
}

/** viem/wagmi often put the actionable sentence only on `details` or nested `cause`. */
function collectErrorText(err: unknown, depth = 0): string {
  if (depth > 8) return "";
  if (err == null) return "";
  if (typeof err === "string") return err.trim();
  if (typeof err !== "object") return String(err);

  const parts: string[] = [];
  const o = err as ErrLike;
  pushStr(parts, o.shortMessage);
  pushStr(parts, o.message);
  pushStr(parts, o.details);
  pushStr(parts, o.reason);
  if (o.code !== undefined) parts.push(String(o.code));
  if (Array.isArray(o.metaMessages)) {
    for (const m of o.metaMessages) pushStr(parts, m);
  }
  pushStr(parts, o.docsPath);
  pushStr(parts, o.version);
  if (o.data !== undefined) {
    if (typeof o.data === "string") pushStr(parts, o.data);
    else if (typeof o.data === "object" && o.data !== null) {
      try {
        pushStr(parts, JSON.stringify(o.data));
      } catch {
        /* ignore */
      }
    }
  }
  if (o.cause) parts.push(collectErrorText(o.cause, depth + 1));

  if (typeof AggregateError !== "undefined" && err instanceof AggregateError) {
    for (const sub of err.errors) {
      parts.push(collectErrorText(sub, depth + 1));
    }
  }

  /* Walk plain objects for any other string fields (viem variants / connector wrappers). */
  if (depth < 4 && typeof err === "object" && err !== null && !Array.isArray(err)) {
    const seen = new Set<unknown>();
    function harvest(x: unknown, d: number) {
      if (d > 6 || x == null || typeof x !== "object" || seen.has(x)) return;
      seen.add(x);
      if (x instanceof Error && d > 0) {
        pushStr(parts, x.message);
        if (x.cause) harvest(x.cause, d + 1);
        return;
      }
      for (const v of Object.values(x as Record<string, unknown>)) {
        if (typeof v === "string") pushStr(parts, v);
        else if (typeof v === "object" && v !== null) harvest(v, d + 1);
      }
    }
    harvest(err, depth);
  }

  const joined = parts.join(" ").trim();
  return joined.length > 12_000 ? joined.slice(0, 12_000) : joined;
}

/**
 * Known wallet / viem shapes we map explicitly (add rows here when QA captures a new
 * `NEXT_PUBLIC_TX_DEBUG=1` generic hit). Substrings are matched on `collectErrorText`
 * output (lowercased where noted in code).
 *
 * | Pattern in collected text | User-facing branch |
 * |---------------------------|----------------------|
 * | `user rejected`, `4001`, `action_rejected` | Cancelled in wallet |
 * | `exceeds the configured cap` + `tx fee` | Rabby / fee-cap |
 * | `rate limit`, `429`, `too many requests` | RPC rate limit |
 * | `insufficient funds` | Not enough gas / balance |
 * | `resource unavailable`, `-32603` | RPC node error |
 * | `not configured` + `eip155:` | Wrong chain vs app |
 * | `execution reverted` | Contract revert |
 */

/**
 * Maps viem / wagmi / wallet / RPC errors to short, actionable copy for UI.
 * Use for bet placement, claim, cashout, chain switch, connect, and casino txs.
 *
 * For subgraph / RSC / generic fetch failures, use {@link formatServerFetchError} from
 * `@/lib/serverFetchError` instead so users never see raw upstream text.
 */
export function formatWalletTxError(error: unknown): string {
  const raw = collectErrorText(error);
  if (!raw) return "Something went wrong. Please try again.";

  const t = raw.toLowerCase();

  if (/msg\.value/i.test(raw)) {
    return "Transaction failed. Check that your stake covers the minimum and network fees, then try again.";
  }

  if (
    t.includes("supportednetworks") ||
    t.includes("not configured in supportednetworks") ||
    (t.includes("not configured") && t.includes("eip155:"))
  ) {
    const m = raw.match(/eip155:(\d+)/i);
    const id = m ? Number(m[1]) : NaN;
    const label = Number.isFinite(id) ? chainName(id) : "this network";
    return `Your wallet is on ${label}, but this app only sends transactions on networks we configure (Polygon, Gnosis, Base, and testnets in the menu). Open the network control in the header and switch to the same chain as your bet, then try again.`;
  }

  if (t.includes("chain not configured") || t.includes("chainnotconfigured")) {
    return "That network is not enabled in this app. Use the header network menu to switch to Polygon, Gnosis, or Base.";
  }

  if (t.includes("wrong network") || t.includes("network mismatch")) {
    return "Your wallet is on the wrong network for this action. Switch using the header menu, then retry.";
  }

  if (
    t.includes("user rejected") ||
    t.includes("user denied") ||
    t.includes("rejected the request") ||
    t.includes("denied transaction") ||
    t.includes("action_rejected") ||
    /\b4001\b/.test(t)
  ) {
    return "You cancelled the request in your wallet.";
  }

  if (t.includes("rejected switch") || t.includes("user rejected switch")) {
    return "Network switch was cancelled in the wallet.";
  }

  if (t.includes("insufficient funds") || t.includes("insufficient balance")) {
    return "Not enough native coin to cover gas (and stake if applicable). Add funds or reduce the amount, then try again.";
  }

  if (
    t.includes("gas required exceeds") ||
    t.includes("intrinsic gas too low") ||
    t.includes("out of gas") ||
    t.includes("exceeds block gas limit")
  ) {
    return "Gas estimation failed or the transaction ran out of gas. Try again with a higher gas limit, or retry when the network is quieter.";
  }

  if (
    t.includes("nonce too low") ||
    t.includes("nonce too high") ||
    t.includes("replacement transaction underpriced") ||
    t.includes("replacement fee too low")
  ) {
    return "A pending or conflicting transaction is blocking this one. Wait for confirmations, clear stuck txs in your wallet, or retry.";
  }

  if (t.includes("network changed") || t.includes("underlying network changed")) {
    return "Your wallet network changed during the action. Switch back to the correct chain and try again.";
  }

  if (
    t.includes("provider is disconnected") ||
    t.includes("providerdisconnected") ||
    t.includes("wallet disconnected")
  ) {
    return "Wallet disconnected. Reconnect in the header and try again.";
  }

  if (t.includes("connector not connected") || t.includes("connectornotconnected")) {
    return "Wallet is not connected. Connect in the header, then retry.";
  }

  if (t.includes("connector not found") || t.includes("connectornotfound")) {
    return "No wallet extension was found. Install MetaMask (or your wallet), refresh, and try again.";
  }

  if (
    t.includes("rate limit") ||
    t.includes("too many requests") ||
    t.includes(" 429 ") ||
    t.includes("exceeds defined limit")
  ) {
    return "The RPC hit a rate limit. Wait a few seconds and try again.";
  }

  if (
    t.includes("resource unavailable") ||
    t.includes("resourceunavailablerpcerror") ||
    t.includes("-32603")
  ) {
    return "The RPC node returned an error. Wait a moment and retry, or switch RPC in your wallet if the problem persists.";
  }

  if (t.includes("execution reverted") || t.includes("transaction reverted")) {
    // viem puts the decoded reason on error.shortMessage / metaMessages, e.g.
    // "execution reverted: LP: condition isn't running" or "…with reason: x".
    // Surface whatever fragment we can so the next attempt isn't a black box.
    const m =
      raw.match(/execution reverted[^:]*:\s*([^\n]+?)(?:\s*Contract Call:|$)/i) ??
      raw.match(/reverted with (?:the following )?(?:reason|custom error)[^:]*:\s*([^\n]+?)(?:\n|$)/i) ??
      raw.match(/reason:\s*([^\n]+?)(?:\n|$)/i);
    const reason = m?.[1]?.trim().replace(/\.$/, "");
    if (typeof console !== "undefined") {
      // Always log so the owner can screenshot devtools if they want the full chain.
      console.error("[formatWalletTxError] contract revert", error);
    }
    const base =
      "The contract reverted this transaction. Check amounts, approvals, and that you are on the correct network, then try again.";
    return reason && reason.length < 200 ? `${base} (reason: ${reason})` : base;
  }

  if (
    t.includes("failed to fetch") ||
    t.includes("networkerror") ||
    t.includes("load failed") ||
    t.includes("network request failed")
  ) {
    return "Network request failed. Check your connection, VPN, or ad-blockers, then try again.";
  }

  if (t.includes("timeout") || t.includes("timed out") || t.includes("request timeout")) {
    return "The request timed out. Check your connection and try again.";
  }

  if (t.includes("contract runner does not support")) {
    return "Your wallet cannot perform this action in the current mode. Try a different browser or wallet.";
  }

  if (t.includes("unknown rpc error")) {
    return "Your wallet could not complete this request on the current network. Use the header menu to switch to Polygon, Gnosis, or Base (the same chain as your bet), then claim again.";
  }

  if (
    t.includes("exceeds the configured cap") ||
    (t.includes("tx fee") && t.includes("configured cap"))
  ) {
    return "Your wallet blocked this transaction because the estimated network fee hit its safety cap (common in Rabby / MetaMask). Raise the max fee cap in wallet settings, or retry after a moment — Claim all already tries smaller on-chain batches when this happens.";
  }

  if (raw.length > 420) {
    return `${raw.slice(0, 400).trim()}…`;
  }

  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_TX_DEBUG === "1"
  ) {
    console.warn("[formatWalletTxError] generic branch", error);
  }
  return raw;
}

/**
 * @deprecated Use {@link formatWalletTxError}. Kept for a short transition; same behavior.
 */
export const formatUserFacingTxError = formatWalletTxError;
