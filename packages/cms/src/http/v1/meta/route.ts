import { getAiSettingsView } from "../../../ai/settings";
import { BLOCKS } from "../../../blocks/definitions";
import { cmsConfig } from "../../../config/resolved";
import { getCmsContentStore } from "../../../container";
import {
	ALLOWED_IMAGE_MIME_TYPES,
	LIST_SORT_FIELDS,
	MAX_MEDIA_BYTES,
	MAX_MEDIA_PIXELS,
	PAGE_SIZES,
} from "../../../core/api";
import { COLLECTION_DEFINITIONS, COLLECTIONS } from "../../../core/collections";
import { MAX_SLUG_LENGTH } from "../../../core/slug";
import { MAX_MDX_BYTES, MAX_METADATA_BYTES, MAX_TITLE_LENGTH } from "../../../core/snapshot";
import { adminRoute, json } from "../handler";

/** 컬렉션 정의(v2 B1 `schemas`와 v1 모양의 요약 `definitions`), 본문 블록 정의(v2 B3 `blocks`)와 서버 제한(§5.6 "서버 설정과 API 메타데이터에 같은 제한을 표시한다"). */
export const GET = adminRoute(async () => {
	const ai = await getAiSettingsView(getCmsContentStore()).then(
		(settings) => settings.fake || settings.providers.some((provider) => provider.ready),
		() => false,
	);
	return json({
		version: "v1",
		collections: COLLECTIONS,
		definitions: COLLECTION_DEFINITIONS,
		schemas: cmsConfig.collections,
		blocks: BLOCKS,
		features: { folders: true, references: true, search: true, templates: true, ai },
		limits: {
			mdxBytes: MAX_MDX_BYTES,
			metadataBytes: MAX_METADATA_BYTES,
			titleLength: MAX_TITLE_LENGTH,
			slugLength: MAX_SLUG_LENGTH,
			mediaBytes: MAX_MEDIA_BYTES,
			mediaPixels: MAX_MEDIA_PIXELS,
			mediaTypes: ALLOWED_IMAGE_MIME_TYPES,
			pageSizes: PAGE_SIZES,
			sortFields: LIST_SORT_FIELDS,
		},
	});
});
