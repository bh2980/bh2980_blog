/**
 * 서버 설정 저작 API. 서버 설정 파일(`cms.server.ts`)이 import하는 진입점이다.
 * 여기서 내보내는 모듈은 서버 설정(`server/resolved.ts`)·`container.ts`를 import하면 안 된다(순환).
 */

export { type GithubAuthOptions, githubAuth } from "../adapters/auth/github";
export { type PostgresOptions, postgres } from "../adapters/postgres/adapter";
export { type R2Options, r2Storage } from "../adapters/r2/adapter";
export {
	type AuthAdapter,
	type AuthContext,
	type AuthProvider,
	type CmsAuth,
	type CmsServerConfig,
	type DatabaseAdapter,
	defineServerConfig,
	type MediaAdapter,
} from "./define";
