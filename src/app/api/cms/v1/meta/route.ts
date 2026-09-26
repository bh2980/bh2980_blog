import {
	ALLOWED_IMAGE_MIME_TYPES,
	LIST_SORT_FIELDS,
	MAX_MEDIA_BYTES,
	MAX_MEDIA_PIXELS,
	PAGE_SIZES,
} from "@/cms/core/api";
import { COLLECTION_DEFINITIONS, COLLECTIONS } from "@/cms/core/collections";
import { getSerializableExtensionsSchema } from "@/cms/core/extensions-example";
import { MAX_SLUG_LENGTH } from "@/cms/core/slug";
import { MAX_MDX_BYTES, MAX_METADATA_BYTES, MAX_TITLE_LENGTH } from "@/cms/core/snapshot";
import { adminRoute, json } from "../handler";

/** 컬렉션 정의와 서버 제한(§5.6 "서버 설정과 API 메타데이터에 같은 제한을 표시한다"). */
export const GET = adminRoute(async () =>
	json({
		version: "v1",
		collections: COLLECTIONS,
		definitions: COLLECTION_DEFINITIONS,
		extensions: getSerializableExtensionsSchema(),
		features: { folders: true, references: true, search: true, templates: true },
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
	}),
);
