import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for EliesBets",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="page-shell mx-auto max-w-2xl">
      <nav className="type-caption mb-6">
        <Link href="/" className="text-emerald-400/90 hover:text-emerald-300">
          ← Home
        </Link>
      </nav>
      <h1 className="type-display mb-6">Terms of Service</h1>
      <div className="type-body space-y-4 text-zinc-300">
        <p className="text-zinc-500">
          <strong className="text-zinc-400">Last updated:</strong> April 15, 2026
        </p>
        <p>
          These Terms of Service govern your access to and use of EliesBets (the “Service”), a
          front-end interface for interacting with decentralized protocols (including Azuro for
          sports markets). By using the Service, you agree to these terms.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">1. The Service</h2>
        <p>
          EliesBets provides a user interface only. We do not custody funds, operate a
          traditional bookmaker, or control smart contracts deployed by third parties. Blockchain
          transactions are irreversible; you are responsible for your wallet, network fees, and
          compliance with laws in your jurisdiction.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">2. Eligibility</h2>
        <p>
          You must be at least 18 years old (or the age of majority where you live). You may not use
          the Service where prohibited by law. It is your responsibility to determine whether use
          of the Service is lawful for you.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">3. No warranty</h2>
        <p>
          The Service is provided “as is” without warranties of any kind. Protocols, oracles, and
          networks may behave unexpectedly. We do not guarantee uptime, accuracy of odds display,
          or fitness for a particular purpose.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">4. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, EliesBets and its contributors shall not be liable
          for any indirect, incidental, or consequential damages arising from your use of the
          Service or on-chain activity.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">5. Changes</h2>
        <p>
          We may update these terms from time to time. Continued use after changes constitutes
          acceptance. Review this page periodically.
        </p>
      </div>
    </div>
  );
}
