import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // History UI retired — keep old bookmarks from 500ing
  async redirects() {
    return [
      {
        source: "/history",
        destination: "/session",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
