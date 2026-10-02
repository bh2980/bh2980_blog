import type { Pool } from "pg";
import type { CollectionsConfig } from "../config/define";

/**
 * 플러그인(v2 M5). 사이트 설정(`cms.config.ts`)의 `plugins`에 한 번만 적는다.
 *
 * - 설정 값(`options`)·사이드바 항목(`nav`)·설정 검사(`validate`)는 서버와 브라우저가 함께 읽는다. 함수 말고는 JSON 값만 둔다.
 * - 서버 코드(`server`)와 관리자 화면 코드(`admin`)는 불러오는 함수로 둔다. 쓸 때만 읽고, 서버 코드는 브라우저 묶음에
 *   들어가지 않게 플러그인 패키지가 브라우저용 빈 진입점(`exports`의 `browser` 조건)을 준다.
 */
export interface CmsPlugin<Name extends string = string, Options = unknown> {
	readonly name: Name;
	readonly options: Options;
	/** 관리자 사이드바의 "관리" 묶음에 더할 항목. `path`는 `/admin/` 뒤 주소이고, 관리자 플러그인의 `pages`가 그린다. */
	readonly nav?: readonly PluginNavItem[];
	/** 사이트 설정을 만들 때 부르는 검사. 잘못된 설정이면 오류를 던진다. */
	readonly validate?: (config: PluginConfigView) => void;
	/** 서버 쪽(API 경로·마이그레이션). 기본 내보내기가 `CmsServerPlugin`이다. */
	readonly server?: () => Promise<{ readonly default: CmsServerPlugin }>;
	/** 관리자 화면 쪽(페이지·공급자). 기본 내보내기가 관리자 패키지의 `CmsAdminPlugin`이다. */
	readonly admin?: () => Promise<{ readonly default: unknown }>;
}

export interface PluginNavItem {
	readonly path: string;
	readonly label: string;
	/** lucide 아이콘 이름(예: `sparkles`). */
	readonly icon?: string;
}

/** 플러그인 검사가 보는 사이트 설정. */
export interface PluginConfigView {
	readonly collections: CollectionsConfig;
	readonly locales: readonly { readonly code: string }[];
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** 플러그인 API 경로 하나. `pattern`은 `/api/cms/` 뒤 주소(예: `v1/ai/run`)이고 `[이름]`은 한 칸이다. */
export interface PluginRoute {
	readonly pattern: string;
	readonly module: Partial<Record<Method, unknown>>;
}

/** 플러그인이 쓰는 DB(지금은 Postgres만, D13). `schema`는 검사한 스키마 이름이라 SQL에 그대로 넣어도 된다. */
export interface PluginDatabase {
	readonly pool: Pool;
	readonly schema: string;
}

export interface CmsServerPlugin {
	/** 본체 경로에 없는 주소를 이 경로표에서 찾는다. */
	readonly routes?: readonly PluginRoute[];
	/** `cms:db:migrate`가 본체 표 다음에 부른다. 여러 번 불러도 같은 결과여야 한다. */
	readonly migrate?: (db: PluginDatabase) => Promise<void>;
	/** 관리자 메타 API(`/v1/meta`)의 `features`에 더할 값. */
	readonly features?: () => Promise<Readonly<Record<string, boolean>>>;
}

/** 플러그인을 만든다. 플러그인 패키지는 이 값을 돌려주는 함수(예: `aiPlugin()`)를 내보낸다. */
export function definePlugin<const Name extends string, Options>(
	plugin: CmsPlugin<Name, Options>,
): CmsPlugin<Name, Options> {
	if (!/^[a-z][a-z0-9-]*$/.test(plugin.name)) throw new Error(`cms plugin: invalid name "${plugin.name}"`);
	return plugin;
}

/** 사이트 설정의 플러그인 목록에서 이름으로 고른 플러그인의 타입. */
export type PluginNamed<Plugins, Name extends string> = Plugins extends readonly (infer P)[]
	? Extract<P, CmsPlugin<Name, unknown>>
	: never;
