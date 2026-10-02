import path from "node:path";
import type { NextConfig } from "next";

export interface WithCmsOptions {
	/** 사이트 설정 파일 경로(서버·브라우저 공용). 프로젝트 루트 기준 상대 경로다(예: `./src/cms.config.ts`). */
	readonly config: string;
	/** 서버 설정 파일 경로(저장소·로그인 연결, 서버 전용). 예: `./src/cms.server.ts`. */
	readonly server: string;
}

const PACKAGES = ["@bh2980/cms"];

/**
 * Next 설정에 CMS 연결을 더한다. 패키지 소스(TypeScript)를 앱과 함께 빌드하고, CMS 코드가 읽는 `@cms-config`·
 * `@cms-server` 별칭을 설정 파일로 잇는다. 타입 검사용 별칭은 앱의 `tsconfig.json` `paths`에 따로 적는다.
 */
export function withCms(nextConfig: NextConfig, options: WithCmsOptions): NextConfig {
	const relative = (file: string) => (file.startsWith(".") ? file : `./${file}`);
	const aliases = { "@cms-config": options.config, "@cms-server": options.server };
	const userWebpack = nextConfig.webpack;

	return {
		...nextConfig,
		transpilePackages: [...new Set([...(nextConfig.transpilePackages ?? []), ...PACKAGES])],
		turbopack: {
			...nextConfig.turbopack,
			resolveAlias: {
				...nextConfig.turbopack?.resolveAlias,
				...Object.fromEntries(Object.entries(aliases).map(([alias, file]) => [alias, relative(file)])),
			},
		},
		webpack: (config, context) => {
			config.resolve ??= {};
			config.resolve.alias = {
				...config.resolve.alias,
				...Object.fromEntries(
					Object.entries(aliases).map(([alias, file]) => [alias, path.resolve(process.cwd(), file)]),
				),
			};
			return userWebpack ? userWebpack(config, context) : config;
		},
	};
}
