# EliesBets

Sports betting web app built with [Next.js](https://nextjs.org) (App Router), [Azuro](https://azuro.org/) SDK/toolkit, and [wagmi](https://wagmi.sh/) for wallet connection on Polygon, Gnosis, and Base.

## Prerequisites

- **Node.js** 20 or newer (LTS recommended)
- **npm** 10+ (comes with Node)

## Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Optional environment variables (create a `.env.local` in the project root):

   | Variable | Purpose |
   |----------|---------|
   | `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata and Open Graph (defaults to `http://localhost:3000` in development). Set this in production (for example `https://your-domain.com`). |
   | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [WalletConnect Cloud](https://cloud.walletconnect.com/) project ID. If omitted, WalletConnect is disabled; injected and MetaMask connectors still work. |

3. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run the production server (after `build`) |
| `npm run lint` | ESLint |

## Tech notes

- UI uses [Tailwind CSS](https://tailwindcss.com/) v4 with [Geist](https://vercel.com/font) and Geist Mono via `next/font`.
- Spacing follows an 8px grid via shared page padding (`page-shell` in `src/app/globals.css`) and consistent gaps across layouts.
