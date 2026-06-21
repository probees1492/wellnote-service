/** @type {import('next').NextConfig} */
const API_TARGET = process.env.API_PROXY_TARGET || "http://127.0.0.1:8787";
const IS_EXPORT = process.env.NEXT_OUTPUT === "export";

const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  ...(IS_EXPORT
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        async rewrites() {
          return [
            { source: "/auth/:path*", destination: `${API_TARGET}/auth/:path*` },
            { source: "/memos/:path*", destination: `${API_TARGET}/memos/:path*` },
            { source: "/memos", destination: `${API_TARGET}/memos` },
            { source: "/pins/:path*", destination: `${API_TARGET}/pins/:path*` },
            { source: "/pins", destination: `${API_TARGET}/pins` },
            { source: "/activity/:path*", destination: `${API_TARGET}/activity/:path*` },
            { source: "/credit/:path*", destination: `${API_TARGET}/credit/:path*` },
            { source: "/streak/:path*", destination: `${API_TARGET}/streak/:path*` },
            { source: "/admin/:path*", destination: `${API_TARGET}/admin/:path*` },
            { source: "/users/:path*", destination: `${API_TARGET}/users/:path*` },
            { source: "/buddies/:path*", destination: `${API_TARGET}/buddies/:path*` },
            { source: "/prompts/:path*", destination: `${API_TARGET}/prompts/:path*` },
          ];
        },
      }),
};

export default nextConfig;
