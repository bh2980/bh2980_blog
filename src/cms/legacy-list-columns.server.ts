import type { CmsServerPlugin, PluginDatabase } from "@bh2980/cms";

/** 예전 열 이름 → 지금 열 이름. */
export const LEGACY_COLUMN_NAMES: Readonly<Record<string, string>> = { category: "categoryId", tags: "tagIds" };

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const isObject = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** 열 설정 하나(`order`·`visibility`·`sizes`)의 예전 이름을 바꾼다. 지금 이름이 이미 있으면 예전 값은 버린다. */
function renameColumns(columns: JsonObject): JsonObject {
	const renamed: JsonObject = { ...columns };
	if (Array.isArray(columns.order)) {
		const order = columns.order.map((column) =>
			typeof column === "string" ? (LEGACY_COLUMN_NAMES[column] ?? column) : column,
		);
		renamed.order = order.filter((column, index) => order.indexOf(column) === index);
	}
	for (const key of ["visibility", "sizes"]) {
		const record = columns[key];
		if (!isObject(record)) continue;
		const next: JsonObject = {};
		for (const [column, value] of Object.entries(record)) {
			const name = LEGACY_COLUMN_NAMES[column];
			if (name === undefined) next[column] = value;
			else if (!Object.hasOwn(record, name)) next[name] = value;
		}
		renamed[key] = next;
	}
	return renamed;
}

/** 저장된 관리자 설정 하나에서 예전 열 이름을 바꾼다(지금 모양 `collections.*.columns`와 예전 모양 `columnSettings.*`). */
export function renameLegacyColumns(preferences: JsonObject): JsonObject {
	const next: JsonObject = { ...preferences };
	if (isObject(preferences.collections)) {
		next.collections = Object.fromEntries(
			Object.entries(preferences.collections).map(([collection, value]) => [
				collection,
				isObject(value) && isObject(value.columns) ? { ...value, columns: renameColumns(value.columns) } : value,
			]),
		);
	}
	if (isObject(preferences.columnSettings)) {
		next.columnSettings = Object.fromEntries(
			Object.entries(preferences.columnSettings).map(([collection, value]) => [
				collection,
				isObject(value) ? renameColumns(value) : value,
			]),
		);
	}
	return next;
}

/** 관리자 설정 표(`user_preferences`)의 예전 열 이름을 바꾼다. 바뀐 행만 고친다. */
export async function migrateLegacyListColumns({ pool, schema }: PluginDatabase): Promise<number> {
	const rows = await pool.query<{ user_id: string; preferences: JsonObject }>(
		`SELECT user_id, preferences FROM "${schema}".user_preferences`,
	);
	let changed = 0;
	for (const row of rows.rows) {
		const next = renameLegacyColumns(row.preferences);
		if (JSON.stringify(next) === JSON.stringify(row.preferences)) continue;
		await pool.query(`UPDATE "${schema}".user_preferences SET preferences = $2 WHERE user_id = $1`, [
			row.user_id,
			JSON.stringify(next),
		]);
		changed += 1;
	}
	return changed;
}

const plugin: CmsServerPlugin = {
	migrate: async (db) => {
		await migrateLegacyListColumns(db);
	},
};

export default plugin;
