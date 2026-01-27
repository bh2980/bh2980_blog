import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["next-mdx-remote"],
	typedRoutes: true,
	serverExternalPackages: ["mermaid-isomorphic", "playwright", "playwright-core"],
};

export default nextConfig;
