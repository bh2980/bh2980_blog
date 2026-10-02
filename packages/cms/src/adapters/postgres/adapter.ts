import { Pool } from "pg";
import type { DatabaseAdapter } from "../../server/define";
import { createContentStore, migrateContentStore } from "./content-store";

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
		createStore: () => createContentStore(getPool(), schema),
		migrate: () => migrateContentStore(getPool(), schema),
		close: async () => {
			await pool?.end();
			pool = undefined;
		},
	};
}
