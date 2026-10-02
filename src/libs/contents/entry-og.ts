import "server-only";

import { resolvePublicMediaUrl } from "@bh2980/cms/mdx/public-image-resolver";
import { createImageOgResponse, createOgImageResponse } from "./og";
import type { SeoMetadata } from "./types/contents";

/**
 * 글·메모의 OG 이미지. 관리자가 공유 이미지를 골랐으면 그 이미지를, 아니면(또는 준비되지 않았으면)
 * 제목으로 만든 카드를 낸다. 공개 상태를 요청마다 확인하므로 캐시하지 않는다.
 */
export async function createEntryOgImage(entry: { title: string; seo?: SeoMetadata }) {
	const custom = entry.seo?.ogImageId ? await resolvePublicMediaUrl(entry.seo.ogImageId) : null;
	return custom ? createImageOgResponse(custom.url) : createOgImageResponse(entry.title, { noStore: true });
}
