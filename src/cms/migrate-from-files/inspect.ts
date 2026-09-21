import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { visit } from "unist-util-visit";
import { analyze } from "@/cms/mdx";
import type { LegacyContentItem, LegacyCorpus } from "./legacy-parser";
import { readLegacyCorpus } from "./legacy-parser";

export interface InspectionIssue {
	code: string;
	path: string;
	message: string;
}

export interface InspectionImage {
	/** 본문에 적힌 공개 경로. */
	sourcePath: string;
	/** 저장소 안 실제 파일 경로(공개 경로 기준). */
	localFile: string;
	referencedBy: string[];
	exists: boolean;
	byteSize: number | null;
	sha256: string | null;
	mimeType: string | null;
	alt: string;
	emptyAlt: boolean;
}

export interface InspectionItem {
	kind: LegacyContentItem["kind"];
	path: string;
	slug: string;
	title: string;
	status: "draft" | "published";
	publishedAt: string | null;
	categorySlug: string | null;
	tagSlugs: string[];
	codeFenceLanguages: string[];
	codeFenceCount: number;
	tableCount: number;
	blockMathCount: number;
	jsxComponents: string[];
	imageCount: number;
}

export interface InspectionReport {
	generatedAt: string;
	root: string;
	counts: {
		posts: number;
		memos: number;
		categories: number;
		tags: number;
		collections: number;
		mdxItems: number;
		images: number;
		imagesMissing: number;
		imagesEmptyAlt: number;
		codeFences: number;
		tables: number;
		blockMath: number;
		jsxComponents: number;
	};
	items: InspectionItem[];
	images: InspectionImage[];
	issues: { blocking: InspectionIssue[]; warnings: InspectionIssue[] };
	slugSets: Record<"posts" | "memos" | "categories" | "tags" | "collections", string[]>;
	notes: string[];
}

const MIME_BY_EXTENSION: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".svg": "image/svg+xml",
};

/**
 * 본문의 이미지 경로는 percent-encoding·NFD로 적혀 있을 수 있다.
 * 저장소의 실제 파일명(NFC)으로 되돌려 해석한다.
 */
const resolvePublicFile = (root: string, url: string): string => {
	const pathOnly = url.split(/[?#]/)[0] ?? url;
	let decoded = pathOnly;
	try {
		decoded = decodeURIComponent(pathOnly);
	} catch {
		decoded = pathOnly;
	}
	const normalized = decoded.normalize("NFC");
	return normalized.startsWith("/") ? path.join(root, "public", normalized) : normalized;
};

interface RawImage {
	url: string;
	alt: string;
}

const collectFromItem = (item: LegacyContentItem) => {
	const images: RawImage[] = [];
	const codeFenceLanguages: string[] = [];
	const jsxComponents = new Set<string>();
	let codeFenceCount = 0;
	let tableCount = 0;
	let blockMathCount = 0;

	const analysis = analyze(item.mdx, item.path);
	if (analysis.tree) {
		visit(analysis.tree, (node) => {
			const typed = node as {
				type: string;
				url?: string;
				alt?: string;
				lang?: string;
				name?: string;
				attributes?: { type: string; name?: string; value?: unknown }[];
			};
			if (typed.type === "code") {
				codeFenceCount += 1;
				if (typed.lang) codeFenceLanguages.push(typed.lang);
				return;
			}
			if (typed.type === "table") {
				tableCount += 1;
				return;
			}
			if (typed.type === "math") {
				blockMathCount += 1;
				return;
			}
			if (typed.type === "image") {
				images.push({ url: typed.url ?? "", alt: typed.alt ?? "" });
				return;
			}
			if (typed.type === "mdxJsxFlowElement" || typed.type === "mdxJsxTextElement") {
				const name = typed.name ?? "";
				jsxComponents.add(name);
				if (name === "Image") {
					const attributes = typed.attributes ?? [];
					const src = attributes.find((attribute) => attribute.name === "src");
					const alt = attributes.find((attribute) => attribute.name === "alt");
					images.push({
						url: typeof src?.value === "string" ? src.value : "",
						alt: typeof alt?.value === "string" ? alt.value : "",
					});
				}
			}
		});
	}

	return { images, codeFenceLanguages, codeFenceCount, tableCount, blockMathCount, jsxComponents: [...jsxComponents] };
};

/** 읽기 전용 검사. DB에 접근하지 않고 `src/contents`만 읽는다. */
export function inspectLegacyCorpus(root: string, options?: { corpus?: LegacyCorpus }): InspectionReport {
	const corpus = options?.corpus ?? readLegacyCorpus(root);
	const blocking: InspectionIssue[] = [];
	const warnings: InspectionIssue[] = [];
	const items: InspectionItem[] = [];
	const imageIndex = new Map<string, InspectionImage>();
	let codeFences = 0;
	let tables = 0;
	let blockMath = 0;
	const jsxNames = new Set<string>();

	const all = [...corpus.posts, ...corpus.memos, ...corpus.categories, ...corpus.tags, ...corpus.collections];

	for (const item of all) {
		const collected = collectFromItem(item);
		codeFences += collected.codeFenceCount;
		tables += collected.tableCount;
		blockMath += collected.blockMathCount;
		for (const name of collected.jsxComponents) jsxNames.add(name);
		for (const image of collected.images) {
			const existing = imageIndex.get(image.url);
			if (existing) {
				existing.referencedBy.push(item.path);
				if (existing.alt.length === 0 && image.alt.length > 0) {
					existing.alt = image.alt;
					existing.emptyAlt = false;
				}
				continue;
			}
			const localFile = resolvePublicFile(root, image.url);
			const stats = statSync(localFile, { throwIfNoEntry: false });
			const isLocal = image.url.startsWith("/assets/");
			const exists = stats?.isFile() ?? false;
			imageIndex.set(image.url, {
				sourcePath: image.url,
				localFile: path.relative(root, localFile),
				referencedBy: [item.path],
				exists,
				byteSize: exists ? (stats?.size ?? null) : null,
				sha256: exists ? createHash("sha256").update(readFileSync(localFile)).digest("hex") : null,
				mimeType: MIME_BY_EXTENSION[path.extname(localFile).toLowerCase()] ?? null,
				alt: image.alt,
				emptyAlt: image.alt.length === 0,
			});

			if (isLocal && !exists) {
				warnings.push({
					code: "missing_image_file",
					path: item.path,
					message: `이미지 파일을 찾을 수 없습니다: ${image.url}`,
				});
			}
			if (isLocal && image.alt.length === 0) {
				warnings.push({ code: "empty_image_alt", path: item.path, message: `빈 alt: ${image.url}` });
			}
		}

		items.push({
			kind: item.kind,
			path: item.path,
			slug: item.slug,
			title: item.title,
			status: item.status,
			publishedAt: item.publishedAt,
			categorySlug: item.categorySlug,
			tagSlugs: item.tagSlugs,
			codeFenceLanguages: collected.codeFenceLanguages,
			codeFenceCount: collected.codeFenceCount,
			tableCount: collected.tableCount,
			blockMathCount: collected.blockMathCount,
			jsxComponents: collected.jsxComponents,
			imageCount: collected.images.length,
		});

		if (item.kind === "post" || item.kind === "memo") {
			if (item.mdx.trim().length === 0) {
				blocking.push({ code: "empty_body", path: item.path, message: "본문이 비어 있습니다." });
			}
			if (item.status === "draft") {
				warnings.push({ code: "draft_status", path: item.path, message: "status가 없거나 draft입니다." });
			}
			if (item.tagSlugs.length === 0) {
				warnings.push({ code: "empty_tags", path: item.path, message: "태그가 없습니다." });
			}
		}
	}

	const duplicateCheck = (kind: string, list: LegacyContentItem[]) => {
		const seen = new Set<string>();
		for (const item of list) {
			if (seen.has(item.slug)) {
				blocking.push({ code: "duplicate_slug", path: item.path, message: `중복 slug(${kind}): ${item.slug}` });
			}
			seen.add(item.slug);
		}
	};
	duplicateCheck("post", corpus.posts);
	duplicateCheck("memo", corpus.memos);
	duplicateCheck("category", corpus.categories);
	duplicateCheck("tag", corpus.tags);
	duplicateCheck("collection", corpus.collections);

	const categorySlugs = new Set(corpus.categories.map((item) => item.slug));
	const tagSlugs = new Set(corpus.tags.map((item) => item.slug));
	const memoSlugs = new Set(corpus.memos.map((item) => item.slug));
	for (const post of corpus.posts) {
		if (!post.categorySlug || !categorySlugs.has(post.categorySlug)) {
			blocking.push({ code: "missing_category", path: post.path, message: `카테고리 미해결: ${post.categorySlug}` });
		}
		for (const tag of post.tagSlugs) {
			if (!tagSlugs.has(tag)) {
				blocking.push({ code: "missing_tag", path: post.path, message: `태그 미해결: ${tag}` });
			}
		}
	}
	for (const memo of corpus.memos) {
		for (const tag of memo.tagSlugs) {
			if (!tagSlugs.has(tag)) {
				blocking.push({ code: "missing_tag", path: memo.path, message: `태그 미해결: ${tag}` });
			}
		}
	}
	for (const collection of corpus.collections) {
		for (const slug of collection.itemSlugs) {
			if (!memoSlugs.has(slug)) {
				blocking.push({
					code: "missing_collection_item",
					path: collection.path,
					message: `모음집 항목 미해결: ${slug}`,
				});
			}
		}
	}

	const images = [...imageIndex.values()].sort((left, right) =>
		left.sourcePath < right.sourcePath ? -1 : left.sourcePath > right.sourcePath ? 1 : 0,
	);

	return {
		generatedAt: new Date().toISOString(),
		root,
		counts: {
			posts: corpus.posts.length,
			memos: corpus.memos.length,
			categories: corpus.categories.length,
			tags: corpus.tags.length,
			collections: corpus.collections.length,
			mdxItems: corpus.posts.length + corpus.memos.length,
			images: images.length,
			imagesMissing: images.filter((image) => !image.exists).length,
			imagesEmptyAlt: images.filter((image) => image.emptyAlt).length,
			codeFences,
			tables,
			blockMath,
			jsxComponents: jsxNames.size,
		},
		items,
		images,
		issues: { blocking, warnings },
		slugSets: {
			posts: corpus.posts.map((item) => item.slug).sort(),
			memos: corpus.memos.map((item) => item.slug).sort(),
			categories: corpus.categories.map((item) => item.slug).sort(),
			tags: corpus.tags.map((item) => item.slug).sort(),
			collections: corpus.collections.map((item) => item.slug).sort(),
		},
		notes: [
			"미디어는 이번 단계에서 보고만 한다. R2 키는 복사 시점에 media/<mediaId>/<uuid>.<ext> 규칙으로 배정한다.",
			"이 보고서는 읽기 전용이며 DB에 접근하지 않는다.",
		],
	};
}
