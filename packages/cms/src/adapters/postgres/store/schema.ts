import type { Pool } from "pg";
import { BUILTIN_AI_FEATURES } from "../../../ai/builtins";
import { DEFAULT_LOCALE } from "../../../core/locales";
import { validateSchemaName } from "./context";

/**
 * 스키마를 만들거나 최신 모양으로 맞춘다. 여러 번 실행해도 결과가 같다(IF NOT EXISTS).
 * 초기 템플릿 같은 일회성 데이터는 `cms_migrations`에 이름을 남겨 한 번만 넣는다.
 */
export async function migrateContentStore(pool: Pool, options?: { schema?: string }): Promise<void> {
	const qSchema = validateSchemaName(options?.schema);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS "${qSchema}".entries (
			id UUID PRIMARY KEY,
			collection TEXT NOT NULL,
			version INTEGER NOT NULL,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL,
			first_published_at TIMESTAMPTZ,
			last_published_at TIMESTAMPTZ,
			published_at TIMESTAMPTZ,
			working_slug TEXT
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".entry_bodies (
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			state TEXT NOT NULL CHECK (state IN ('working', 'published')),
			metadata JSONB NOT NULL,
			mdx TEXT NOT NULL,
			schema_version INTEGER NOT NULL,
			content_hash TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL,
			PRIMARY KEY (entry_id, state)
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".content_addresses (
			collection TEXT NOT NULL,
			slug TEXT NOT NULL,
			entry_id UUID REFERENCES "${qSchema}".entries(id) ON DELETE SET NULL,
			type TEXT NOT NULL CHECK (type IN ('reservation', 'current', 'alias', 'deleted')),
			PRIMARY KEY (collection, slug)
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".media_assets (
			id UUID PRIMARY KEY,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleting')),
			filename TEXT NOT NULL DEFAULT '',
			mime_type TEXT,
			byte_size BIGINT,
			width INTEGER,
			height INTEGER,
			staging_key TEXT,
			storage_key TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			ready_at TIMESTAMPTZ
		);

		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleting'));
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS filename TEXT NOT NULL DEFAULT '';
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS mime_type TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS byte_size BIGINT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS width INTEGER;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS height INTEGER;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS staging_key TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS storage_key TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

		CREATE TABLE IF NOT EXISTS "${qSchema}".entry_references (
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			state TEXT NOT NULL CHECK (state IN ('working', 'published')),
			kind TEXT NOT NULL CHECK (kind IN ('entry', 'media', 'category', 'tag')),
			target_id UUID NOT NULL,
			target_entry_id UUID REFERENCES "${qSchema}".entries(id),
			target_media_id UUID REFERENCES "${qSchema}".media_assets(id),
			is_stale BOOLEAN NOT NULL,
			occurrences JSONB NOT NULL,
			UNIQUE (entry_id, state, kind, target_id),
			CHECK (
				(kind = 'media' AND target_entry_id IS NULL AND target_media_id IS NOT NULL AND target_id = target_media_id) OR
				(kind IN ('entry', 'category', 'tag') AND target_entry_id IS NOT NULL AND target_media_id IS NULL AND target_id = target_entry_id)
			)
		);
		-- 관계 참조의 종류를 콘텐츠(entry)·미디어(media) 둘로 줄였다. 예전 category·tag 행을 entry로 바꾼다.
		-- 같은 대상의 entry 행이 이미 있으면 남겨 둔다(읽을 때 entry로 다룬다).
		UPDATE "${qSchema}".entry_references r SET kind = 'entry'
		WHERE r.kind IN ('category', 'tag') AND NOT EXISTS (
			SELECT 1 FROM "${qSchema}".entry_references d
			WHERE d.entry_id = r.entry_id AND d.state = r.state AND d.kind = 'entry' AND d.target_id = r.target_id
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".folders (
			id UUID PRIMARY KEY,
			collection TEXT NOT NULL,
			parent_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION,
			name TEXT NOT NULL,
			position INTEGER NOT NULL,
			version INTEGER NOT NULL DEFAULT 1
		);

		ALTER TABLE "${qSchema}".folders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

		CREATE UNIQUE INDEX IF NOT EXISTS folders_sibling_name_idx ON "${qSchema}".folders(
			collection,
			name,
			COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
		);

		ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION;

		ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'trashed'));

		CREATE TABLE IF NOT EXISTS "${qSchema}".schedules (
			id UUID PRIMARY KEY,
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			scheduled_at TIMESTAMPTZ NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
			created_at TIMESTAMPTZ NOT NULL,
			completed_at TIMESTAMPTZ,
			failure_code TEXT,
			failure_detail TEXT
		);

		CREATE INDEX IF NOT EXISTS schedules_due_idx ON "${qSchema}".schedules(scheduled_at) WHERE status = 'pending';
		CREATE UNIQUE INDEX IF NOT EXISTS schedules_active_entry_idx ON "${qSchema}".schedules(entry_id) WHERE status = 'pending';

		ALTER TABLE "${qSchema}".content_addresses ALTER COLUMN entry_id DROP NOT NULL;
		ALTER TABLE "${qSchema}".content_addresses DROP CONSTRAINT IF EXISTS content_addresses_entry_id_fkey;
		ALTER TABLE "${qSchema}".content_addresses ADD CONSTRAINT content_addresses_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES "${qSchema}".entries(id) ON DELETE SET NULL;

		ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';
		-- v3 번역 화면: 번역본의 번역 단위(원문 조각·번역). 원문은 NULL이다.
		ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS translation JSONB;

		CREATE TABLE IF NOT EXISTS "${qSchema}".user_preferences (
			user_id TEXT PRIMARY KEY,
			preferences JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".cms_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".body_templates (
			id UUID PRIMARY KEY,
			name TEXT NOT NULL,
			mdx TEXT NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);

		DROP INDEX IF EXISTS "${qSchema}".body_templates_collection_name_idx;
		-- 예전 메모·포스트에 같은 이름이 있으면 한쪽 이름만 구분해 본문과 ID를 모두 보존한다.
		WITH ranked AS (
			SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS position
			FROM "${qSchema}".body_templates
		)
		UPDATE "${qSchema}".body_templates AS template
		SET name = left(template.name, 50) || ' (통합 ' || template.id::text || ')'
		FROM ranked WHERE template.id = ranked.id AND ranked.position > 1;
		ALTER TABLE "${qSchema}".body_templates DROP COLUMN IF EXISTS for_collection;
		CREATE UNIQUE INDEX IF NOT EXISTS body_templates_name_idx
		ON "${qSchema}".body_templates (lower(name));

		ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ;
		UPDATE "${qSchema}".entries SET trashed_at = updated_at WHERE status = 'trashed' AND trashed_at IS NULL;

		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS default_alt TEXT NOT NULL DEFAULT '';
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS default_caption TEXT NOT NULL DEFAULT '';
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_staging_key TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_storage_key TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_mime_type TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_byte_size BIGINT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_width INTEGER;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_height INTEGER;
		CREATE INDEX IF NOT EXISTS media_assets_pending_idx ON "${qSchema}".media_assets(created_at) WHERE status IN ('pending', 'failed');

		-- v2 B4 다국어: 언어별 문서 + 번역 묶음. 번역 묶음 ID는 원문의 ID이고, 원문은 NULL(자기 자신)로 둔다.
		ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT '${DEFAULT_LOCALE}';
		ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS translation_group_id UUID REFERENCES "${qSchema}".entries(id) ON DELETE NO ACTION;
		CREATE UNIQUE INDEX IF NOT EXISTS entries_translation_locale_key
		ON "${qSchema}".entries ((COALESCE(translation_group_id, id)), locale);
		ALTER TABLE "${qSchema}".content_addresses ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT '${DEFAULT_LOCALE}';
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.key_column_usage
				WHERE table_schema = '${qSchema}' AND table_name = 'content_addresses'
				  AND constraint_name = 'content_addresses_pkey' AND column_name = 'locale'
			) THEN
				ALTER TABLE "${qSchema}".content_addresses DROP CONSTRAINT content_addresses_pkey;
				ALTER TABLE "${qSchema}".content_addresses ADD CONSTRAINT content_addresses_pkey PRIMARY KEY (collection, locale, slug);
			END IF;
		END $$;

		-- v2 D AI 기능 정의. 조합(붙는 곳·보낼 내용·결과·적용·검사·지시문)은 spec JSON 하나에 둔다.
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_features (
			id UUID PRIMARY KEY,
			builtin TEXT UNIQUE,
			spec JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		-- 추가 요청 받기(askInstruction)를 더하기 전에 넣은 기본 기능은, 값이 없을 때만 기본값(켬)을 채운다.
		UPDATE "${qSchema}".ai_features SET spec = spec || '{"askInstruction": true}'::jsonb
		WHERE builtin IN ('summary', 'imageAlt', 'imageCaption', 'codeFold') AND NOT (spec ? 'askInstruction');

		-- 미디어 기본 대체 텍스트는 본문 이미지의 대체 텍스트 추천을 같이 쓴다(따로 두던 기능을 지운다).
		DELETE FROM "${qSchema}".ai_features WHERE builtin = 'mediaAlt';

		-- v2 D AI 서비스 연결(주소·암호화한 키·모델). 한 줄만 쓴다(id = 'default').
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_settings (
			id TEXT PRIMARY KEY,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`);

	// 기본 AI 기능을 하나씩 한 번만 넣는다. 나중에 더한 기본 기능도 들어가고, 지운 기본 기능은 되살리지 않는다.
	for (const [builtin, feature] of Object.entries(BUILTIN_AI_FEATURES)) {
		const marker = `seed_v2_ai_feature:${builtin}`;
		const seeded = await pool.query(`SELECT 1 FROM "${qSchema}".cms_migrations WHERE name = $1`, [marker]);
		if (seeded.rows.length > 0) continue;
		await pool.query(
			`INSERT INTO "${qSchema}".ai_features (id, builtin, spec) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			[feature.id, builtin, JSON.stringify(feature.spec)],
		);
		await pool.query(`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, [marker]);
	}

	// One-time seed for initial default body templates (idempotent; won't resurrect deleted templates)
	const seedCheck = await pool.query(
		`SELECT 1 FROM "${qSchema}".cms_migrations WHERE name = 'seed_initial_body_templates'`,
	);
	if (seedCheck.rows.length === 0) {
		const initialTemplates = [
			{
				id: "00000000-0000-4000-8000-000000000001",
				name: "알고리즘 풀이",
				mdx: "## 문제\n\n\n## 풀이\n\n```ts\n\n```\n",
			},
			{
				id: "00000000-0000-4000-8000-000000000002",
				name: "Type Challenge 풀이",
				mdx: "### 질문\n\n\n```ts\n\n```\n\n### 풀이\n\n",
			},
		];
		for (const t of initialTemplates) {
			await pool.query(
				`INSERT INTO "${qSchema}".body_templates (id, name, mdx, version, created_at, updated_at)
				 VALUES ($1, $2, $3, 1, NOW(), NOW())
				 ON CONFLICT DO NOTHING`,
				[t.id, t.name, t.mdx],
			);
		}
		await pool.query(
			`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ('seed_initial_body_templates') ON CONFLICT DO NOTHING`,
		);
	}

	// Add the general post template once; conflict handling never overwrites user templates.
	const postTemplateSeedCheck = await pool.query(
		`SELECT 1 FROM "${qSchema}".cms_migrations WHERE name = 'seed_m12_default_post_template'`,
	);
	if (postTemplateSeedCheck.rows.length === 0) {
		await pool.query(
			`INSERT INTO "${qSchema}".body_templates (id, name, mdx, version, created_at, updated_at)
			 VALUES ($1, $2, $3, 1, NOW(), NOW())
			 ON CONFLICT DO NOTHING`,
			[
				"00000000-0000-4000-8000-000000000003",
				"일반 게시글",
				"## 개요\n\n글의 핵심을 소개합니다.\n\n## 본문\n\n\n## 정리\n\n마무리 내용을 작성합니다.\n",
			],
		);
		await pool.query(
			`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ('seed_m12_default_post_template') ON CONFLICT DO NOTHING`,
		);
	}
}
