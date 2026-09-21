import { Pool } from "pg";
import { createContentStore, type ContentStore } from "./adapters/postgres/content-store";
import { createContentService } from "./services/content-service";

export type ContentService = ReturnType<typeof createContentService>;

declare global {
	var __cmsPool: Pool | undefined;
	var __cmsStore: ContentStore | undefined;
	var __cmsService: ContentService | undefined;
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
		global.__cmsStore = createContentStore(pool);
	}
	return global.__cmsStore;
}

export function getCmsContentService(): ContentService {
	if (!global.__cmsService) {
		const store = getCmsContentStore();
		global.__cmsService = createContentService(store);
	}
	return global.__cmsService;
}
