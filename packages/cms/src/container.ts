import { Pool } from "pg";
import { type ContentStore, createContentStore, type Entry } from "./adapters/postgres/content-store";
import { createR2MediaStore } from "./adapters/r2/media-store";
import type { MediaStore } from "./adapters/r2/types";
import { createContentService } from "./services/content-service";

export type ContentService = ReturnType<typeof createContentService<Entry>>;

declare global {
	var __cmsPool: Pool | undefined;
	var __cmsStore: ContentStore | undefined;
	var __cmsService: ContentService | undefined;
	var __cmsMediaStore: MediaStore | undefined;
}

export function getCmsPool(): Pool {
	if (!global.__cmsPool) {
		const connectionString = process.env.CMS_DATABASE_URL;
		if (!connectionString) {
			throw new Error("CMS_DATABASE_URL is not configured");
		}
		global.__cmsPool = new Pool({ connectionString });
	}
	return global.__cmsPool;
}

export function getCmsContentStore(): ContentStore {
	if (!global.__cmsStore) {
		const pool = getCmsPool();
		// `CMS_SCHEMA`로 기본값(`public`)을 바꿀 수 있다. 같은 DB를 여러 스키마로 나눠 쓰는
		// 미리보기/스테이징에서 쓴다. 운영은 미설정이므로 `public` 그대로다.
		const schema = process.env.CMS_SCHEMA;
		global.__cmsStore = createContentStore(pool, schema ? { schema } : undefined);
	}
	return global.__cmsStore;
}

export function getCmsContentService(): ContentService {
	if (!global.__cmsService) {
		const store = getCmsContentStore();
		global.__cmsService = createContentService<Entry>(store);
	}
	return global.__cmsService;
}

export function getCmsMediaStore(): MediaStore {
	if (!global.__cmsMediaStore) {
		const accountId = process.env.CMS_R2_ACCOUNT_ID;
		const accessKeyId = process.env.CMS_R2_ACCESS_KEY_ID;
		const secretAccessKey = process.env.CMS_R2_SECRET_ACCESS_KEY;
		const bucket = process.env.CMS_R2_BUCKET;
		const endpoint = process.env.CMS_R2_ENDPOINT;
		const publicBaseUrl = process.env.CMS_R2_PUBLIC_BASE_URL;

		if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint || !publicBaseUrl) {
			throw new Error("CMS R2 storage environment variables are not fully configured");
		}

		global.__cmsMediaStore = createR2MediaStore({
			accountId,
			accessKeyId,
			secretAccessKey,
			bucket,
			endpoint,
			publicBaseUrl,
		});
	}
	return global.__cmsMediaStore;
}
