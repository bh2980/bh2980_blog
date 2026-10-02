import path from "node:path";
import { pathToFileURL } from "node:url";

/** Node 모듈 해석 훅(`register.ts`가 등록한다). 설정 별칭만 앱의 파일로 바꾸고 나머지는 그대로 넘긴다. */
const ALIASES: Readonly<Record<string, string>> = {
	"@cms-config": process.env.CMS_CONFIG_PATH ?? "./cms.config.ts",
	"@cms-server": process.env.CMS_SERVER_PATH ?? "./cms.server.ts",
};

type Resolve = (
	specifier: string,
	context: unknown,
	next: (specifier: string, context: unknown) => Promise<unknown>,
) => Promise<unknown>;

export const resolve: Resolve = (specifier, context, next) => {
	const file = ALIASES[specifier];
	return file ? next(pathToFileURL(path.resolve(process.cwd(), file)).href, context) : next(specifier, context);
};
