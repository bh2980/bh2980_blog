import type { PluginDatabase } from "@bh2980/cms";
import { legacyFeatureOverride } from "./actions";

/**
 * AI 플러그인 표. `cms:db:migrate`가 본체 표 다음에 부른다. 여러 번 불러도 결과가 같다.
 * 예전(본체에 AI가 있던 때) 저장소도 표 이름과 이전 표시가 같아 그대로 이어 쓴다.
 */
export async function migrateAi({ pool, schema, once }: PluginDatabase): Promise<void> {
	const qSchema = schema;
	await pool.query(`
		-- AI 기능의 고친 값(M2). 기능 정의는 사이트 설정에 있고, 관리자 화면에서 고친 값만 기능 이름별로 둔다.
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_action_overrides (
			key TEXT PRIMARY KEY,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		-- 화면 기능(M8-5): 관리자 AI 화면에서 만든 기능. 값은 기본 정보와 고친 값이다.
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_custom_actions (
			key TEXT PRIMARY KEY,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		-- v2 D AI 서비스 연결(주소·암호화한 키·모델). 한 줄만 쓴다(id = 'default'). 고친 공통 문구는 'shared' 줄이다.
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_settings (
			id TEXT PRIMARY KEY,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`);

	// 예전 AI 기능 표(`ai_features`)에 고친 값이 있으면 한 번만 기능 이름별 고친 값으로 옮긴다. 예전 표는 지우지 않는다.
	// 이름은 예전 기록과 같다(플러그인 이름을 붙이기 전에 남긴 기록이 있다).
	await once("migrate_ai_features_to_actions", async (client) => {
		const legacy = await client.query<{ exists: string | null }>(`SELECT to_regclass($1)::text AS exists`, [
			`"${qSchema}".ai_features`,
		]);
		if (!legacy.rows[0]?.exists) return;
		const rows = await client.query<{ builtin: string | null; spec: unknown }>(
			`SELECT builtin, spec FROM "${qSchema}".ai_features WHERE builtin IS NOT NULL`,
		);
		for (const row of rows.rows) {
			const value = row.builtin ? legacyFeatureOverride(row.builtin, row.spec) : null;
			if (!value || Object.keys(value).length === 0) continue;
			await client.query(
				`INSERT INTO "${qSchema}".ai_action_overrides (key, value, version, updated_at) VALUES ($1, $2, 1, NOW())
				 ON CONFLICT (key) DO NOTHING`,
				[row.builtin, JSON.stringify(value)],
			);
		}
	});
}
