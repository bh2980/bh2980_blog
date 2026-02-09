import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["next-mdx-remote"],
	typedRoutes: true,
	serverExternalPackages: [
		"mermaid-isomorphic",
		"mermaid",
		"@fortawesome/fontawesome-free",
		"playwright",
		"playwright-core",
	],
};

export default nextConfig;
