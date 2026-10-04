import type { PoolClient } from "pg";
import type { EntryStatusChange } from "../../../plugin/define";
import type { Queryable, StoreContext } from "./context";

/**
 * 플러그인 글 갈고리를 부르는 곳(`EntryHooks`). 갈고리가 없으면 아무 일도 하지 않는다.
 */
export function createEntryHookRunner(ctx: StoreContext) {
	const hooks = async () => (ctx.hooks.entryHooks ? await ctx.hooks.entryHooks() : []);

	/** 글마다 잠근 플러그인 이름(먼저 잠근 플러그인). 잠기지 않은 글은 없다. */
	const lockedBy = async (client: Queryable, entryIds: readonly string[]): Promise<Map<string, string>> => {
		const result = new Map<string, string>();
		if (entryIds.length === 0) return result;
		for (const hook of await hooks()) {
			if (!hook.locked) continue;
			const ids = await hook.locked({ client, schema: ctx.qSchema }, entryIds);
			for (const id of ids) if (!result.has(id)) result.set(id, hook.name);
		}
		return result;
	};

	return {
		lockedBy,
		statusChanged: async (client: PoolClient, change: EntryStatusChange) => {
			if (change.entryIds.length === 0) return;
			for (const hook of await hooks()) {
				await hook.afterStatusChange?.({ client, schema: ctx.qSchema }, change);
			}
		},
	};
}

export type EntryHookRunner = ReturnType<typeof createEntryHookRunner>;
