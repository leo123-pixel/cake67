import type { NextConfig } from "next";

// Only this project's Supabase Storage may be optimized by next/image.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required to build");

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(supabaseUrl).hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
