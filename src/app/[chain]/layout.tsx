import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChainParamBinder } from "@/components/ChainParamBinder";
import {
  CHAIN_SLUGS,
  chainIdFromSlug,
  isChainSlug,
} from "@/lib/sportsChainConstants";

/**
 * Per-chain layout: validates the `:chain` slug and pre-renders the 3 supported
 * chains at build time. Lives outside the dynamic path (no `cookies()` here)
 * so Next can statically render everything underneath when the page itself
 * doesn't opt out.
 */
export function generateStaticParams() {
  return CHAIN_SLUGS.map((chain) => ({ chain }));
}

type Props = {
  children: ReactNode;
  params: Promise<{ chain: string }>;
};

export default async function ChainLayout({ children, params }: Props) {
  const { chain } = await params;
  if (!isChainSlug(chain)) {
    notFound();
  }
  const chainId = chainIdFromSlug(chain);
  return (
    <>
      <ChainParamBinder chainId={chainId} />
      {children}
    </>
  );
}
