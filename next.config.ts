import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /** Enables React view transitions for Link navigation (see Next.js docs). */
    viewTransition: true,
  },
};

export default nextConfig;
