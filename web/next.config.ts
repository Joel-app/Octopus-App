import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workforce-app/shared"],
  experimental: {
    // Default is 1MB, too small for real ID/licence photos uploaded through
    // the staff compliance form's Server Action.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
