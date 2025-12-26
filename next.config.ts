import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["next-mdx-remote"],
	typedRoutes: true,
};

export default nextConfig;
