import { BUILTIN_AI_FEATURES, withBuiltin } from "../../../ai/builtins";
import type { AiFeature, AiFeatureSpec } from "../../../ai/definition";
import { type StoreContext, withTransaction } from "./context";
import { CmsError } from "./errors";

interface AiFeatureRow {
	id: string;
	builtin: string | null;
	spec: unknown;
	version: number;
	created_at: Date;
	updated_at: Date;
}

const COLUMNS = "id, builtin, spec, version, created_at, updated_at";

/**
 * 저장된 정의를 읽는다. 기능마다 정해 둔 부분은 코드의 정의로 덮는다(코드가 바뀌면 저장값보다 앞선다).
 * 기능 목록에 없는 줄(예전에 직접 만든 기능 등)은 `null`이라 목록에서 빠진다.
 */
function mapRow(row: AiFeatureRow): AiFeature | null {
	const spec = withBuiltin(row.builtin, row.spec);
	if (!spec) return null;
	return {
		...spec,
		id: row.id,
		builtin: row.builtin,
		version: row.version,
		createdAt: row.created_at.toISOString(),
		updatedAt: row.updated_at.toISOString(),
	};
}

const required = (feature: AiFeature | null): AiFeature => {
	if (!feature) throw new CmsError("AI feature has an invalid definition", "invalid_state");
	return feature;
};

/** v2 D AI 기능 정의(`ai_features`)와 AI 검사에 필요한 조회. */
export function createAiOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;

	const lockCurrent = async (
		client: { query: typeof pool.query },
		id: string,
		expectedVersion: number,
	): Promise<AiFeatureRow> => {
		const res = await client.query<AiFeatureRow>(
			`SELECT ${COLUMNS} FROM "${qSchema}".ai_features WHERE id = $1 FOR UPDATE`,
			[id],
		);
		const cur = res.rows[0];
		if (!cur) throw new CmsError("AI feature not found", "not_found");
		if (cur.version !== expectedVersion) throw new CmsError("Conflict", "conflict", cur.version);
		return cur;
	};

	const writeSpec = async (
		client: { query: typeof pool.query },
		id: string,
		spec: AiFeatureSpec,
		version: number,
	): Promise<AiFeature> => {
		const res = await client.query<AiFeatureRow>(
			`UPDATE "${qSchema}".ai_features SET spec = $2, version = $3, updated_at = NOW() WHERE id = $1 RETURNING ${COLUMNS}`,
			[id, JSON.stringify(spec), version],
		);
		return required(mapRow(res.rows[0] as AiFeatureRow));
	};

	return {
		listAiFeatures: async (): Promise<AiFeature[]> => {
			const res = await pool.query<AiFeatureRow>(
				`SELECT ${COLUMNS} FROM "${qSchema}".ai_features ORDER BY created_at ASC, id ASC`,
			);
			// 기능 목록(코드) 순서대로 보인다.
			const order = Object.keys(BUILTIN_AI_FEATURES);
			return res.rows
				.map(mapRow)
				.filter((feature): feature is AiFeature => feature !== null)
				.sort((a, b) => order.indexOf(a.builtin ?? "") - order.indexOf(b.builtin ?? ""));
		},

		getAiFeature: async (id: string): Promise<AiFeature> => {
			const res = await pool.query<AiFeatureRow>(`SELECT ${COLUMNS} FROM "${qSchema}".ai_features WHERE id = $1`, [id]);
			if (!res.rows[0]) throw new CmsError("AI feature not found", "not_found");
			return required(mapRow(res.rows[0]));
		},

		/** 고칠 수 있는 부분만 반영한다. 정해 둔 부분(이름·자리·결과 등)은 보내도 기능 정의대로 남는다. */
		updateAiFeature: async (params: { id: string; expectedVersion: number; spec: AiFeatureSpec }): Promise<AiFeature> =>
			withTransaction(pool, async (client) => {
				const cur = await lockCurrent(client, params.id, params.expectedVersion);
				const spec = withBuiltin(cur.builtin, params.spec);
				if (!spec) throw new CmsError("AI feature not found", "not_found");
				return writeSpec(client, params.id, spec, cur.version + 1);
			}),

		/** 기본 기능을 처음 정의로 되돌린다. 켜짐 여부는 지금 값을 둔다. */
		resetAiFeature: async (params: { id: string; expectedVersion: number }): Promise<AiFeature> =>
			withTransaction(pool, async (client) => {
				const cur = await lockCurrent(client, params.id, params.expectedVersion);
				const builtin = cur.builtin ? BUILTIN_AI_FEATURES[cur.builtin] : undefined;
				if (!builtin) throw new CmsError("Only built-in AI features can be reset", "invalid_input");
				const base = withBuiltin(cur.builtin, builtin.spec);
				if (!base) throw new CmsError("AI feature not found", "not_found");
				const enabled = withBuiltin(cur.builtin, cur.spec)?.enabled ?? base.enabled;
				return writeSpec(client, params.id, { ...base, enabled }, cur.version + 1);
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
