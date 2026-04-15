import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for EliesBets",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="page-shell mx-auto max-w-2xl">
      <nav className="type-caption mb-6">
        <Link href="/" className="text-emerald-400/90 hover:text-emerald-300">
          ← Home
        </Link>
      </nav>
      <h1 className="type-display mb-6">Privacy Policy</h1>
      <div className="type-body space-y-4 text-zinc-300">
        <p className="text-zinc-500">
          <strong className="text-zinc-400">Last updated:</strong> April 15, 2026
        </p>
        <p>
          This Privacy Policy describes how EliesBets (“we”, “us”) handles information when you use
          our website and web application.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">1. Information we process</h2>
        <p>
          The Service is designed to minimize collection of personal data. Wallet addresses and
          on-chain activity are public on the blockchain. We may use hosting and analytics providers
          (e.g. Vercel Analytics) that process technical data such as page views, device type, and
          approximate location in aggregated form.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">2. Cookies and storage</h2>
        <p>
          We may use cookies or local storage for preferences (e.g. odds format, wallet connection
          state via your browser). You can clear site data in your browser settings.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">3. Third parties</h2>
        <p>
          Interactions with wallet providers, RPC endpoints, and protocols (e.g. Azuro) are subject
          to those parties’ terms and privacy practices.
        </p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">4. Children</h2>
        <p>The Service is not intended for users under 18.</p>
        <h2 className="type-title mt-8 text-lg text-zinc-100">5. Contact</h2>
        <p>
          For privacy-related requests, contact the project operator through the official channels
          listed on the site (once published).
        </p>
        <p className="border-t border-zinc-800 pt-6 text-sm text-zinc-500">
          This policy may be updated from time to time. Material changes will be reflected on this
          page with an updated date.
        </p>
      </div>
    </div>
  );
}
