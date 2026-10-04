import { Pool } from "pg";
import type { PluginDatabase } from "../../plugin/define";
import type { DatabaseAdapter } from "../../server/define";
import { createContentStore, migrateContentStore } from "./content-store";
import { validateSchemaName } from "./store/context";
import { runOnce } from "./store/schema";

export interface PostgresOptions {
	/** 연결 주소. 처음 쓸 때 없으면 오류를 낸다(빌드 중에는 비어 있어도 된다). */
	readonly connectionString: string | undefined;
	/** 표를 둘 스키마. 같은 DB를 미리보기·스테이징과 나눠 쓸 때 바꾼다. 기본값은 `public`. */
	readonly schema?: string;
}

/** Postgres 콘텐츠 저장소. */
export function postgres(options: PostgresOptions): DatabaseAdapter {
	let pool: Pool | undefined;
	const getPool = () => {
		if (!options.connectionString) throw new Error("cms.server: postgres connectionString is not configured");
		pool ??= new Pool({ connectionString: options.connectionString });
		return pool;
	};
	const schema = options.schema ? { schema: options.schema } : undefined;
	return {
		name: "postgres",
		createStore: (storeOptions) => createContentStore(getPool(), { ...schema, ...storeOptions }),
		migrate: () => migrateContentStore(getPool(), schema),
		pluginDatabase: () => pluginDatabaseFor(getPool(), options.schema),
		close: async () => {
			await pool?.end();
			pool = undefined;
		},
	};
}

/** 플러그인이 쓰는 DB(연결·스키마·한 번만 하는 일). 테스트에서도 같은 모양을 만든다. */
export function pluginDatabaseFor(pool: Pool, schema?: string): PluginDatabase {
	const qSchema = validateSchemaName(schema);
	return { pool, schema: qSchema, once: (name, run) => runOnce(pool, { schema: qSchema }, name, run) };
}
