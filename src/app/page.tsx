import { redirect } from "next/navigation";
import { DEFAULT_CHAIN_SLUG } from "@/lib/sportsChainConstants";

/**
 * `/` is a static shell that redirects into the default chain. Middleware
 * normally catches this first (respecting the `appChainId` cookie); this is
 * the fallback when middleware is bypassed (e.g., during tests).
 */
export default function RootRedirect() {
  redirect(`/${DEFAULT_CHAIN_SLUG}`);
}
