import { isAddress, zeroAddress, type Address } from "viem";

/**
 * Sports affiliate wallet — the address that receives GGR (gross gaming
 * revenue) share on every bet placed via this frontend. Read once from env
 * so it's identical server-side (sitemap, RSC render) and client-side.
 *
 * `useAvailableFreebets` is also gated on `Boolean(affiliate)` server-side —
 * bonuses are scoped to an affiliate "pool", so the zero-address path returns
 * no freebets regardless of what's been minted.
 *
 * Set `NEXT_PUBLIC_AZURO_AFFILIATE` in Vercel to your registered address.
 * If unset, we fall back to `zeroAddress` so preview/dev still functions,
 * with a one-time console warning in the browser.
 */
function readAffiliateFromEnv(): Address {
  const raw = process.env.NEXT_PUBLIC_AZURO_AFFILIATE?.trim();
  if (raw && isAddress(raw) && raw.toLowerCase() !== zeroAddress) {
    return raw as Address;
  }
  if (
    typeof window !== "undefined" &&
    process.env.NODE_ENV !== "test" &&
    !warnedMissingAffiliate
  ) {
    // Loud-but-not-blocking: team should see this in browser console and fix
    // via env var; we don't throw because preview deploys without the var
    // should still be usable.
    console.warn(
      "[affiliate] NEXT_PUBLIC_AZURO_AFFILIATE is unset or invalid — " +
        "falling back to the zero address. GGR revenue and freebets will not " +
        "work until this is set to your registered Azuro affiliate wallet.",
    );
    warnedMissingAffiliate = true;
  }
  return zeroAddress;
}

let warnedMissingAffiliate = false;

export const AZURO_AFFILIATE: Address = readAffiliateFromEnv();
