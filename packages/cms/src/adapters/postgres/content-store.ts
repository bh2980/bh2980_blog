import type { Pool } from "pg";
import { createAiOps } from "./store/ai";
import { type ContentStoreHooks, type StoreContext, validateSchemaName } from "./store/context";
import { createEntryOps } from "./store/entries";
import { createFolderOps } from "./store/folders";
import { createLifecycleOps } from "./store/lifecycle";
import { createListOps } from "./store/list";
import { createMediaOps } from "./store/media";
import { createPreferenceOps } from "./store/preferences";
import { createPublicReadOps } from "./store/public-read";
import { createPublishing } from "./store/publish";
import { createScheduleOps } from "./store/schedules";
import { createTemplateOps } from "./store/templates";
import { createTransferOps } from "./store/transfer";

/**
 * PostgreSQL `ContentStore`(§9.3). 콘텐츠·폴더·관계·미디어 메타데이터·설정의 조회와 원자적 변경.
 * 드라이버와 SQL은 `store/` 아래 모듈에만 있다. 업무 규칙(스냅샷·발행 검증)은 `core/`에서 가져온다.
 */

export { PUBLIC_COLLECTIONS } from "./store/constants";
export type { ContentStoreHooks } from "./store/context";
export { CmsError } from "./store/errors";
export type { FolderRow } from "./store/rows";
export { extractVisibleText, normalizeMetadata } from "./store/rows";
export { migrateContentStore } from "./store/schema";
export * from "./store/types";

export function createContentStore(
	pool: Pool,
	options?: { schema?: string; beforePublishCommit?: ContentStoreHooks["beforePublishCommit"] },
) {
	const ctx: StoreContext = {
		pool,
		qSchema: validateSchemaName(options?.schema),
		hooks: { beforePublishCommit: options?.beforePublishCommit },
	};
	const publishing = createPublishing(ctx);

	return {
		...createEntryOps(ctx, publishing),
		...createLifecycleOps(ctx, publishing),
		...createListOps(ctx),
		...createFolderOps(ctx),
		...createPublicReadOps(ctx),
		...createPreferenceOps(ctx),
		...createTransferOps(ctx),
		...createScheduleOps(ctx, publishing),
		...createMediaOps(ctx),
		...createTemplateOps(ctx),
		...createAiOps(ctx),
	};
}

export type ContentStore = ReturnType<typeof createContentStore>;
