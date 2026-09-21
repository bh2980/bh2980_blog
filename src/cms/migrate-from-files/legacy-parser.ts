import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseYamlMapping, splitFrontmatter } from "@/cms/mdx/frontmatter";
import type { CmsJsonValue } from "@/cms/mdx/types";

export type LegacyKind = "post" | "memo" | "category" | "tag" | "collection";

export interface LegacyContentItem {
	kind: LegacyKind;
	/** 저장소 루트 기준 POSIX 경로. 안정 ID의 키다. */
	path: string;
	slug: string;
	title: string;
	/** Keystatic 기본값과 동일하게 status 누락은 draft로 본다. */
	status: "draft" | "published";
	publishedAt: string | null;
	categorySlug: string | null;
	tagSlugs: string[];
	policy: string | null;
	/** 모음집(collection)만 사용한다. */
	itemSlugs: string[];
	mdx: string;
	frontmatter: Record<string, CmsJsonValue>;
}

export interface LegacyCorpus {
	posts: LegacyContentItem[];
	memos: LegacyContentItem[];
	categories: LegacyContentItem[];
	tags: LegacyContentItem[];
	collections: LegacyContentItem[];
}

const asString = (value: CmsJsonValue | undefined): string | null =>
	typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asStringArray = (value: CmsJsonValue | undefined): string[] => {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
		.map((item) => item.trim());
};

const slugFromFilename = (file: string): string => path.basename(file, path.extname(file)).normalize("NFC");

const listFiles = (dir: string, extension: string): string[] => {
	if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
	return readdirSync(dir)
		.filter((entry) => entry.endsWith(extension) && !entry.startsWith("."))
		.sort((left, right) => (left < right ? -1 : 1));
};

const readMdxItem = (rootDir: string, kind: "post" | "memo", absolutePath: string): LegacyContentItem => {
	const source = readFileSync(absolutePath, "utf8");
	const { raw, body } = splitFrontmatter(source);
	const frontmatter = raw === null ? {} : parseYamlMapping(raw);
	const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join("/");
	const policyValue =
		frontmatter.policy && typeof frontmatter.policy === "object" && !Array.isArray(frontmatter.policy)
			? asString((frontmatter.policy as Record<string, CmsJsonValue>).discriminant)
			: null;

	return {
		kind,
		path: relativePath,
		slug: slugFromFilename(absolutePath),
		title: asString(frontmatter.title) ?? slugFromFilename(absolutePath),
		status: frontmatter.status === "published" ? "published" : "draft",
		publishedAt: asString(frontmatter.publishedDateTimeISO),
		categorySlug: kind === "post" ? asString(frontmatter.category) : null,
		tagSlugs: asStringArray(frontmatter.tags),
		policy: policyValue,
		itemSlugs: [],
		mdx: body,
		frontmatter,
	};
};

const readRecordItem = (
	rootDir: string,
	kind: "category" | "tag" | "collection",
	absolutePath: string,
): LegacyContentItem => {
	const frontmatter = parseYamlMapping(readFileSync(absolutePath, "utf8"));
	const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join("/");
	const meta = frontmatter.meta;
	const metaRecord =
		meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, CmsJsonValue>) : null;
	const value = metaRecord?.value;
	const valueRecord =
		value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, CmsJsonValue>) : null;
	const itemSlugs = kind === "collection" ? asStringArray(valueRecord?.memo) : [];
	const slug = slugFromFilename(absolutePath);

	return {
		kind,
		path: relativePath,
		slug,
		title: asString(frontmatter.name) ?? slug,
		status: "published",
		publishedAt: null,
		categorySlug: null,
		tagSlugs: [],
		policy: null,
		itemSlugs,
		mdx: "",
		frontmatter,
	};
};

/** 기존 `src/contents` 트리를 읽어 이전 계획의 입력으로 쓴다. 저장소를 변경하지 않는다. */
export function readLegacyCorpus(rootDir: string): LegacyCorpus {
	const contents = path.join(rootDir, "src", "contents");
	const readAll = (dirName: string, extension: string) => listFiles(path.join(contents, dirName), extension);

	return {
		posts: readAll("posts", ".mdx").map((file) => readMdxItem(rootDir, "post", path.join(contents, "posts", file))),
		memos: readAll("memos", ".mdx").map((file) => readMdxItem(rootDir, "memo", path.join(contents, "memos", file))),
		categories: readAll("categories", ".yaml").map((file) =>
			readRecordItem(rootDir, "category", path.join(contents, "categories", file)),
		),
		tags: readAll("tags", ".yaml").map((file) => readRecordItem(rootDir, "tag", path.join(contents, "tags", file))),
		collections: readAll("collections", ".yaml").map((file) =>
			readRecordItem(rootDir, "collection", path.join(contents, "collections", file)),
		),
	};
}
