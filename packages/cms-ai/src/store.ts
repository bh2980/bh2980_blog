import type { PluginDatabase } from "@bh2980/cms";
import { withTransaction } from "@bh2980/cms/adapters/postgres/store/context";
import { CmsError } from "@bh2980/cms/adapters/postgres/store/errors";
import { getCmsDatabase } from "@bh2980/cms/plugin/server";

/** 기능 이름별로 고친 값 한 줄. */
export interface AiActionOverrideRow {
	key: string;
	/** 정의와 다른 고친 값(`aiActionOverrideSchema` 모양). */
	value: unknown;
	version: number;
	updatedAt: Date;
}

/** v2 D AI 기능의 고친 값(`ai_action_overrides`)·연결 설정(`ai_settings`)과 AI 검사에 필요한 조회. */
export function createAiStore({ pool, schema: qSchema }: PluginDatabase) {
	return {
		/** 고친 값 전부. 고친 적 없는 기능은 없다. */
		listAiActionOverrides: async (): Promise<AiActionOverrideRow[]> => {
			const res = await pool.query<{ key: string; value: unknown; version: number; updated_at: Date }>(
				`SELECT key, value, version, updated_at FROM "${qSchema}".ai_action_overrides ORDER BY key`,
			);
			return res.rows.map((row) => ({
				key: row.key,
				value: row.value,
				version: row.version,
				updatedAt: row.updated_at,
			}));
		},

		/**
		 * 고친 값을 바꾼다. 처음이면 `expectedVersion`이 0이고, 그 뒤로는 버전이 다르면 409다.
		 * 고친 값이 비면(모두 기본값) 줄을 남겨 버전을 이어 간다.
		 */
		saveAiActionOverride: async (params: {
			key: string;
			expectedVersion: number;
			value: unknown;
		}): Promise<AiActionOverrideRow> =>
			withTransaction(pool, async (client) => {
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_action_overrides WHERE key = $1 FOR UPDATE`,
					[params.key],
				);
				const version = cur.rows[0]?.version ?? 0;
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				const res = await client.query<{ key: string; value: unknown; version: number; updated_at: Date }>(
					`INSERT INTO "${qSchema}".ai_action_overrides (key, value, version, updated_at) VALUES ($1, $2, $3, NOW())
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()
					 RETURNING key, value, version, updated_at`,
					[params.key, JSON.stringify(params.value), version + 1],
				);
				const row = res.rows[0] as { key: string; value: unknown; version: number; updated_at: Date };
				return { key: row.key, value: row.value, version: row.version, updatedAt: row.updated_at };
			}),

		/** AI 서비스 연결 설정(저장한 모양 그대로). 없으면 `null`. */
		getAiSettings: async (): Promise<{ value: unknown; version: number } | null> => {
			const res = await pool.query<{ value: unknown; version: number }>(
				`SELECT value, version FROM "${qSchema}".ai_settings WHERE id = 'default'`,
			);
			return res.rows[0] ?? null;
		},

		/** 연결 설정을 저장한다. 처음이면 `expectedVersion`이 0이고, 그 뒤로는 버전이 다르면 409다. */
		saveAiSettings: async (params: { expectedVersion: number; value: unknown }): Promise<number> =>
			withTransaction(pool, async (client) => {
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_settings WHERE id = 'default' FOR UPDATE`,
				);
				const version = cur.rows[0]?.version ?? 0;
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				await client.query(
					`INSERT INTO "${qSchema}".ai_settings (id, value, version, updated_at) VALUES ('default', $1, $2, NOW())
					 ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()`,
					[JSON.stringify(params.value), version + 1],
				);
				return version + 1;
			}),

		/** 후보 주소 중 같은 컬렉션·언어에서 다른 글이 쓰거나 예약한 것. */
		findTakenSlugs: async (params: {
			collection: string;
			locale: string;
			slugs: string[];
			entryId?: string;
		}): Promise<Set<string>> => {
			if (params.slugs.length === 0) return new Set();
			const res = await pool.query<{ slug: string }>(
				`SELECT slug FROM "${qSchema}".content_addresses
				 WHERE collection = $1 AND locale = $2 AND slug = ANY($3::text[])
				   AND ($4::uuid IS NULL OR entry_id <> $4::uuid)`,
				[params.collection, params.locale, params.slugs, params.entryId ?? null],
			);
			return new Set(res.rows.map((row) => row.slug));
		},
	};
}

export type AiStore = ReturnType<typeof createAiStore>;

declare global {
	var __cmsAiStore: AiStore | undefined;
}

/** 본체 DB 연결로 만든 AI 저장소. 개발 서버가 모듈을 다시 읽어도 하나만 둔다. */
export function getAiStore(): AiStore {
	global.__cmsAiStore ??= createAiStore(getCmsDatabase());
	return global.__cmsAiStore;
}
