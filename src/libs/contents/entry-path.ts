import { contentPath } from "@bh2980/cms/client";
import { type Locale, localizePath } from "@/libs/i18n/locales";

/**
 * 글·메모 상세의 공개 주소. 모양(`/posts/:slug`)은 컬렉션 정의(`cms.config.ts`의 `path`)가 정하고, 언어 접두사는 `localizePath`가 붙인다.
 * 서버 컴포넌트·라우트에서 쓴다(브라우저 번들에 사이트 설정을 싣지 않으려고 클라이언트 컴포넌트는 따로 둔다).
 */
export function entryPath(locale: Locale, collection: "post" | "memo", slug: string): string {
	return localizePath(locale, contentPath(collection, slug) ?? "/");
}
