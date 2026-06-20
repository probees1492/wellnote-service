/** @type {import('next').NextConfig} */
const API_TARGET = process.env.API_PROXY_TARGET || "http://127.0.0.1:8787";

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    return [
      // Proxy all known API roots to the backend Worker to avoid CORS in dev.
      { source: "/auth/:path*", destination: `${API_TARGET}/auth/:path*` },
      { source: "/memos/:path*", destination: `${API_TARGET}/memos/:path*` },
      { source: "/memos", destination: `${API_TARGET}/memos` },
      {
        source: "/activity/:path*",
        destination: `${API_TARGET}/activity/:path*`,
      },
      { source: "/credit/:path*", destination: `${API_TARGET}/credit/:path*` },
      { source: "/admin/:path*", destination: `${API_TARGET}/admin/:path*` },
    ];
  },
};

export default nextConfig;
