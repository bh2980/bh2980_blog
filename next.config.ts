import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["next-mdx-remote"],
	typedRoutes: true,
	serverExternalPackages: ["mermaid-isomorphic", "mermaid", "playwright", "playwright-core"],
};

export default nextConfig;
