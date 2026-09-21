import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export interface FixtureCorpusOptions {
	postPolicy?: string | null;
	postCategory?: string | null;
	postTags?: string[];
	memoStatus?: string | null;
	collectionItems?: string[];
	missingTagFile?: boolean;
	imageAlt?: string;
	includeImage?: boolean;
	missingImageFile?: boolean;
}

const write = (root: string, relative: string, content: string) => {
	const target = path.join(root, relative);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, content, "utf8");
};

/** `src/contents` 최소 픽스처를 임시 디렉터리에 만든다. */
export const createFixtureCorpus = (options: FixtureCorpusOptions = {}): { root: string; cleanup: () => void } => {
	const root = mkdtempSync(path.join(tmpdir(), "cms-m6-corpus-"));

	write(
		root,
		"src/contents/posts/첫-글.mdx",
		[
			"---",
			"status: published",
			`category: ${options.postCategory ?? "development"}`,
			"title: 첫 글",
			"publishedDateTimeISO: 2026-01-02T03:04:00.000Z",
			"tags:",
			`  - ${(options.postTags ?? ["blog"])[0]}`,
			...(options.postPolicy === null ? [] : ["policy:", `  discriminant: ${options.postPolicy ?? "normal"}`]),
			"---",
			"## 본문",
			"",
			...(options.includeImage === false
				? []
				: [`![${options.imageAlt ?? "스크린샷"}](/assets/images/posts/fixture.png)`]),
			"",
			"본문 내용",
			"",
			"```ts",
			"const value = 1",
			"```",
			"",
			"| a | b |",
			"| --- | --- |",
			"| 1 | 2 |",
		].join("\n"),
	);

	if (options.includeImage !== false && options.missingImageFile !== true) {
		write(root, "public/assets/images/posts/fixture.png", "fake-png-bytes");
	}

	const memoStatusLine = options.memoStatus === null ? [] : [`status: ${options.memoStatus ?? "published"}`];
	write(
		root,
		"src/contents/memos/메모-하나.mdx",
		[
			"---",
			"title: 메모 하나",
			...memoStatusLine,
			"publishedDateTimeISO: 2026-01-03T03:04:00.000Z",
			"tags:",
			"  - blog",
			"---",
			"메모 본문",
		].join("\n"),
	);

	write(root, "src/contents/categories/development.yaml", "name: 개발\n");
	write(root, "src/contents/tags/blog.yaml", "name: 블로그\n");
	if (!options.missingTagFile) {
		write(root, "src/contents/tags/extra.yaml", "name: 추가\n");
	}
	write(
		root,
		"src/contents/collections/모음.yaml",
		[
			"name: 모음",
			"description: 모음 설명",
			"meta:",
			"  discriminant: wiki",
			"  value:",
			"    memo:",
			...(options.collectionItems ?? ["메모-하나"]).map((slug) => `      - ${slug}`),
		].join("\n"),
	);

	return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
};
