import type { CmsPlugin } from "@bh2980/cms";
import { cmsConfig } from "@bh2980/cms/client";
import { BAREUN_PLUGIN_NAME, type ResolvedBareunOptions, resolveBareunOptions } from "./options";

/** 사이트 설정에 등록한 바른 검사기의 설정. 서버 경로와 관리자 화면이 함께 읽는다. */
export function readBareunOptions(): ResolvedBareunOptions {
	// 플러그인이 없는 설정은 빈 튜플 타입이라 넓혀 읽는다.
	const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
	const options = plugins.find((plugin) => plugin.name === BAREUN_PLUGIN_NAME)?.options;
	return (options as ResolvedBareunOptions | undefined) ?? resolveBareunOptions();
}
