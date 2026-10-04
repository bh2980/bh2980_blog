import { cmsConfig } from "../config/resolved";
import { cmsServerConfig } from "../server/resolved";
import type { CmsPlugin, CmsServerPlugin, NamedEntryHooks, PluginDatabase, PluginRoute } from "./define";

/** 사이트 설정의 플러그인. 플러그인이 없는 설정은 빈 튜플 타입이라 넓혀 읽는다. */
const PLUGINS: readonly CmsPlugin[] = cmsConfig.plugins ?? [];

/**
 * 사이트 설정의 플러그인 서버 쪽을 불러온다. 처음 부를 때 한 번 읽고 다시 쓴다.
 * 서버 쪽이 없는 플러그인은 빈 값이다.
 */
let loaded: Promise<readonly (CmsServerPlugin & { readonly name: string })[]> | undefined;

export function loadServerPlugins(): Promise<readonly (CmsServerPlugin & { readonly name: string })[]> {
	loaded ??= Promise.all(PLUGINS.map(async (plugin) => ({ name: plugin.name, ...(await plugin.server?.())?.default })));
	return loaded;
}

/** 플러그인 API 경로표(플러그인 순서대로). */
export async function pluginRoutes(): Promise<readonly PluginRoute[]> {
	return (await loadServerPlugins()).flatMap((plugin) => plugin.routes ?? []);
}

/** 플러그인이 쓰는 DB 연결. */
export const getCmsDatabase = (): PluginDatabase => cmsServerConfig.database.pluginDatabase();

/** 플러그인 표를 만든다. 본체 표를 만든 다음(`cms:db:migrate`) 부른다. */
export async function migratePlugins(): Promise<void> {
	for (const plugin of await loadServerPlugins()) {
		if (!plugin.migrate) continue;
		console.log(`Migrating plugin "${plugin.name}"...`);
		await plugin.migrate(getCmsDatabase());
	}
}

/** 플러그인이 메타 API에 더하는 기능 표시. 실패한 플러그인은 빼고 나머지를 돌려준다. */
export async function pluginFeatures(): Promise<Record<string, boolean>> {
	const plugins = await loadServerPlugins();
	const features = await Promise.all(plugins.map((plugin) => plugin.features?.().catch(() => ({})) ?? {}));
	return Object.assign({}, ...features);
}

/** 플러그인의 글 갈고리(플러그인 순서대로). 저장소가 글을 바꿀 때 부른다. */
export async function pluginEntryHooks(): Promise<readonly NamedEntryHooks[]> {
	return (await loadServerPlugins()).flatMap((plugin) =>
		plugin.entryHooks ? [{ name: plugin.name, ...plugin.entryHooks }] : [],
	);
}
