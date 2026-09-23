import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { compileMDX } from "next-mdx-remote/rsc";
import type { Pool } from "pg";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "@/cms/adapters/postgres/__test__/test-database";
import { type ContentStore, createContentStore, migrateContentStore } from "@/cms/adapters/postgres/content-store";
import { buildImportPlan } from "@/cms/migrate-from-files/import-plan";
import { type LegacyCorpus, readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { planDigest, runProductionApply } from "@/cms/migrate-from-files/production-runner";
import { MDX_COMPONENTS, MDX_REHYPE_PLUGINS, MDX_REMARK_PLUGINS } from "@/components/mdx/mdx-content";
import { PostgresRepository } from "@/libs/contents/repositories/postgres";

/**
 * M9-TW-1의 실행 가능한 선행 검증: **이관 → 저장 → 공개 조회 → 렌더** 사슬이 원본과 같은 HTML을 내는가.
 *
 * 운영 DB가 아니라 격리 schema에서 운영 경로(`runProductionApply`)를 그대로 돌린다. 그래서
 * 이 테스트가 통과하면 "이관하다 클나는" 경우(분류 해석 실패로 글이 사라짐, slug 불일치,
 * 본문 손실, 초안 유출)를 전환 전에 배제할 수 있다.
 *
 * 남는 것: 실제 Keystatic 배포 ↔ postgres 배포의 **HTTP 응답** 대조(M9-TW-1 본체)는
 * 두 배포가 필요하므로 전환 시점에 별도로 실행한다.
 */
const hasTestDatabase = Boolean(process.env.CMS_TEST_DATABASE_URL);
const describeWithDb = hasTestDatabase ? describe : describe.skip;

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/** M8-DA-1과 같은 정규화. 표기 차이를 접고 화면 동작이 같은지 본다. */
const canonical = (html: string): string =>
	html.replaceAll("<span>ㅤ</span>", "<p><br/></p>").replace(/<br\/>\s+/g, "<br/>");

/**
 * 실제 `pre`(코드 하이라이트)는 비동기라 `renderToStaticMarkup`에서 suspend한다.
 * M8-DA-1 검증과 같은 shim으로 바꾼다. 양쪽 본문이 **같은 파이프라인**을 타므로
 * 하이라이터를 빼도 본문 등가성 비교는 유효하다(`pre`의 실제 RSC 렌더는 M7-TW-1이 고정했다).
 */
const PreShim = ({ children, title }: { children?: ReactNode; title?: string }) => (
	<div data-parity-pre-shim data-title={title}>
		{children}
	</div>
);

const renderPublic = async (source: string): Promise<string> => {
	const { content } = await compileMDX({
		source,
		options: { mdxOptions: { remarkPlugins: MDX_REMARK_PLUGINS(), rehypePlugins: MDX_REHYPE_PLUGINS } },
		components: { ...MDX_COMPONENTS, pre: PreShim },
	});

	return renderToStaticMarkup(content);
};

const imageSources = (html: string): string[] => {
	const found = new Set<string>();
	for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
		found.add(match[1]);
	}
	return [...found].sort();
};

describeWithDb("M9-TW-1 이관 후 공개 렌더 등가성 (실DB)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let repo: PostgresRepository;
	let corpus: LegacyCorpus;
	let outDir: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		outDir = mkdtempSync(path.join(tmpdir(), "cms-m9-parity-"));

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		repo = new PostgresRepository(() => store);

		corpus = readLegacyCorpus(REPO_ROOT);
		const plan = await buildImportPlan(corpus);

		// 운영 경로를 그대로 쓴다. 격리 schema라 운영 DB는 건드리지 않는다.
		await runProductionApply({
			root: REPO_ROOT,
			pool,
			schemaName,
			expectedDigest: planDigest(plan),
			expectedItems: plan.counts.items,
			expectedExistingEntries: 0,
			out: path.join(outDir, "parity-import.json"),
		});
	}, 300_000);

	afterAll(async () => {
		rmSync(outDir, { recursive: true, force: true });
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("공개 목록이 원본과 같은 편수·slug 집합이다", async () => {
		const posts = await repo.listPosts({});
		const memos = await repo.listMemos({});

		const expectedPosts = corpus.posts.filter((item) => item.status === "published");
		const expectedMemos = corpus.memos.filter((item) => item.status === "published");

		expect(posts).toHaveLength(expectedPosts.length);
		expect(memos).toHaveLength(expectedMemos.length);
		expect(posts.map((post) => post.slug).sort()).toEqual(expectedPosts.map((item) => item.slug).sort());
		expect(memos.map((memo) => memo.slug).sort()).toEqual(expectedMemos.map((item) => item.slug).sort());
	});

	it("status 없는 메모 1편은 공개 조회에서 보이지 않는다", async () => {
		const draft = corpus.memos.find((item) => item.status === "draft");
		expect(draft).toBeDefined();

		await expect(repo.getMemo(draft?.slug as string)).resolves.toBeNull();

		// 목록에도 없어야 한다. 이관이 초안을 조용히 승격하지 않았다는 뜻이다.
		const memos = await repo.listMemos({});
		expect(memos.map((memo) => memo.slug)).not.toContain(draft?.slug);
	});

	it("메타데이터가 원본과 일치한다(제목·분류·태그)", async () => {
		const mismatches: string[] = [];
		const categoryTitles = new Map(corpus.categories.map((item) => [item.slug, item.title]));
		const tagTitles = new Map(corpus.tags.map((item) => [item.slug, item.title]));

		for (const source of corpus.posts) {
			const post = await repo.getPost(source.slug);
			if (!post) {
				mismatches.push(`${source.slug}: 공개 조회 실패`);
				continue;
			}
			if (post.title !== source.title) mismatches.push(`${source.slug}: 제목 "${post.title}" ≠ "${source.title}"`);
			if (source.categorySlug && post.category?.label !== categoryTitles.get(source.categorySlug)) {
				mismatches.push(`${source.slug}: 분류 "${post.category?.label}"`);
			}
			const expectedTags = source.tagSlugs.map((slug) => tagTitles.get(slug)).sort();
			const actualTags = (post.tags ?? []).map((tag) => tag.label).sort();
			if (JSON.stringify(expectedTags) !== JSON.stringify(actualTags)) {
				mismatches.push(`${source.slug}: 태그 ${JSON.stringify(actualTags)} ≠ ${JSON.stringify(expectedTags)}`);
			}
		}

		expect(mismatches).toEqual([]);
	});

	it("발행 48편의 공개 본문 렌더가 원본 렌더와 같다", async () => {
		const mismatches: string[] = [];
		const sources = [
			...corpus.posts.filter((item) => item.status === "published"),
			...corpus.memos.filter((item) => item.status === "published"),
		];

		for (const source of sources) {
			const isPost = corpus.posts.includes(source);
			const stored = isPost ? await repo.getPost(source.slug) : await repo.getMemo(source.slug);
			if (!stored) {
				mismatches.push(`${source.slug}: 공개 조회 실패`);
				continue;
			}

			try {
				const fromDb = await renderPublic(stored.contentMdx);
				const fromSource = await renderPublic(source.mdx);
				if (canonical(fromDb) !== canonical(fromSource)) {
					mismatches.push(`${source.path} (DB ${fromDb.length}자 / 원본 ${fromSource.length}자)`);
				}
			} catch (error) {
				// 한 편이 렌더에 실패해도 나머지 결과를 가리지 않도록 모아서 보고한다.
				mismatches.push(`${source.path} 렌더 실패: ${(error as Error).message.slice(0, 120)}`);
			}
		}

		expect(sources.length).toBe(48);
		expect(mismatches).toEqual([]);
	}, 300_000);

	it("공개 본문에 남은 이미지 경로가 실제 파일로 존재한다", async () => {
		const missing = new Set<string>();
		let imageCount = 0;

		for (const source of [...corpus.posts, ...corpus.memos].filter((item) => item.status === "published")) {
			const isPost = corpus.posts.includes(source);
			const stored = isPost ? await repo.getPost(source.slug) : await repo.getMemo(source.slug);
			if (!stored) continue;

			let html: string;
			try {
				html = await renderPublic(stored.contentMdx);
			} catch (error) {
				missing.add(`${source.path}: 렌더 실패 ${(error as Error).message.slice(0, 80)}`);
				continue;
			}
			for (const src of imageSources(html)) {
				imageCount += 1;
				if (!src.startsWith("/")) continue;
				// 한글·공백 파일명은 URL에서 퍼센트 인코딩된다. 파일 검사 전에 되돌린다.
				const localPath = path.join(REPO_ROOT, "public", decodeURIComponent(src).replace(/^\//, ""));
				if (!existsSync(localPath)) missing.add(src);
			}
		}

		expect(imageCount).toBeGreaterThan(0);
		expect([...missing]).toEqual([]);
	}, 300_000);
});
