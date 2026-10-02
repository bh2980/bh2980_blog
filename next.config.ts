import { withCms } from "@bh2980/cms/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// 같은 저장소에서 개발 서버를 하나 더 띄울 때(검수용 격리 스키마 등) 빌드 폴더를 나눈다.
	distDir: process.env.NEXT_DIST_DIR || ".next",
	reactStrictMode: true,
	transpilePackages: ["next-mdx-remote"],
	typedRoutes: true,
};

export default withCms(nextConfig, { config: "./src/cms.config.ts" });
