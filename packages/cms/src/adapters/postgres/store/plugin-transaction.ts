import type { PoolClient } from "pg";
import type { StoreContext } from "./context";
import type { Publishing, PublishOptions } from "./publish";
import { lockEntryForUpdate } from "./rows";

/**
 * 플러그인이 제 트랜잭션 안에서 쓰는 글 작업(예: 예약 확장이 예약 행과 발행을 한 트랜잭션으로 묶는다).
 * 본체 발행과 같은 검증·규칙을 쓴다. 트랜잭션은 `withTransaction`(`@bh2980/cms/plugin-server`)으로 연다.
 */
export function createPluginTransactionOps(ctx: StoreContext, publishing: Publishing) {
	return {
		/** 글 행을 잠그고 읽는다. `expectedVersion`이 다르면 `conflict`다. */
		lockEntryInTransaction: (client: PoolClient, id: string, expectedVersion?: number) =>
			lockEntryForUpdate(client, ctx.qSchema, id, expectedVersion),
		/** 저장된 초안을 발행 검증한다. 문제가 있으면 `publish_validation_failed`로 던진다. */
		validateForPublishInTransaction: (client: PoolClient, id: string) =>
			publishing.validateStoredWorkingForPublish(client, id),
		/** 저장된 초안을 발행한다(본체 발행과 같다). */
		publishInTransaction: (client: PoolClient, id: string, options: PublishOptions) =>
			publishing.publishWithinTransaction(client, id, options),
	};
}
