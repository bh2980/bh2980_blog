import type { Pool } from "pg";
import { cmsConfig } from "../../../config/resolved";
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
			kind TEXT NOT NULL CONSTRAINT entry_references_kind_check CHECK (kind IN ('entry', 'media')),
			target_id UUID NOT NULL,
			target_entry_id UUID REFERENCES "${qSchema}".entries(id),
			target_media_id UUID REFERENCES "${qSchema}".media_assets(id),
			is_stale BOOLEAN NOT NULL,
			occurrences JSONB NOT NULL,
			UNIQUE (entry_id, state, kind, target_id),
			CONSTRAINT entry_references_target_check CHECK (
				(kind = 'media' AND target_entry_id IS NULL AND target_media_id IS NOT NULL AND target_id = target_media_id) OR
				(kind = 'entry' AND target_entry_id IS NOT NULL AND target_media_id IS NULL AND target_id = target_entry_id)
			)
		);
		-- 관계 참조의 종류를 콘텐츠(entry)·미디어(media) 둘로 줄였다. 예전 저장소에 남은 category·tag 행을 entry 행으로 옮긴다.
		-- 같은 콘텐츠·상태·대상의 예전 행(category·tag)과 entry 행은 한 행으로 합친다: 위치(occurrences)는 entry 행 것 뒤에
		-- 없는 것만 붙이고, 하나라도 오래된 참조(is_stale)면 오래된 참조다(읽을 때 entry로 다루던 것과 같은 결과).
		WITH legacy AS (
			SELECT r.entry_id, r.state, r.target_id,
				COALESCE(jsonb_agg(o.value ORDER BY r.kind, o.ordinality) FILTER (WHERE o.value IS NOT NULL), '[]'::jsonb) AS occurrences,
				bool_or(r.is_stale) AS is_stale
			FROM "${qSchema}".entry_references r
			LEFT JOIN LATERAL jsonb_array_elements(r.occurrences) WITH ORDINALITY AS o(value, ordinality) ON TRUE
			WHERE r.kind IN ('category', 'tag')
			GROUP BY r.entry_id, r.state, r.target_id
		)
		INSERT INTO "${qSchema}".entry_references AS d
			(entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
		SELECT entry_id, state, 'entry', target_id, target_id, NULL, is_stale, occurrences FROM legacy
		ON CONFLICT (entry_id, state, kind, target_id) DO UPDATE SET
			is_stale = d.is_stale OR EXCLUDED.is_stale,
			occurrences = d.occurrences || COALESCE(
				(SELECT jsonb_agg(x.value ORDER BY x.ordinality)
				 FROM jsonb_array_elements(EXCLUDED.occurrences) WITH ORDINALITY AS x(value, ordinality)
				 WHERE NOT d.occurrences @> jsonb_build_array(x.value)),
				'[]'::jsonb
			);
		DELETE FROM "${qSchema}".entry_references WHERE kind IN ('category', 'tag');
		-- 예전 행이 없어졌으니 종류 제약을 entry·media로 좁힌다. 예전 제약(이름이 저장소마다 다를 수 있다)은 정의로 찾아 지운다.
		DO $$
		DECLARE
			old_constraint record;
			target regclass := to_regclass(format('%I.entry_references', '${qSchema}'));
		BEGIN
			FOR old_constraint IN
				SELECT conname FROM pg_constraint
				WHERE conrelid = target AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%category%'
			LOOP
				EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', target, old_constraint.conname);
			END LOOP;
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = target AND conname = 'entry_references_kind_check') THEN
				ALTER TABLE "${qSchema}".entry_references
					ADD CONSTRAINT entry_references_kind_check CHECK (kind IN ('entry', 'media'));
			END IF;
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = target AND conname = 'entry_references_target_check') THEN
				ALTER TABLE "${qSchema}".entry_references ADD CONSTRAINT entry_references_target_check CHECK (
					(kind = 'media' AND target_entry_id IS NULL AND target_media_id IS NOT NULL AND target_id = target_media_id) OR
					(kind = 'entry' AND target_entry_id IS NOT NULL AND target_media_id IS NULL AND target_id = target_entry_id)
				);
			END IF;
		END $$;

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

	`);

	// 사이트 설정의 초기 본문 템플릿을 새 저장소에 한 번만 넣는다. 이미 넣은 저장소에는 나중에 더한 템플릿도
	// 넣지 않고, 지운 템플릿을 되살리지 않는다.
	const seedCheck = await pool.query(
		`SELECT 1 FROM "${qSchema}".cms_migrations WHERE name = 'seed_initial_body_templates'`,
	);
	if (seedCheck.rows.length === 0) {
		const initialTemplates = cmsConfig.seed?.templates ?? [];
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
}
