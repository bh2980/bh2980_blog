import { createHash } from "node:crypto";
import { analyze } from "../mdx";
import {
	type Collection,
	type Issue,
	type JsonValue,
	type PreparedSnapshot,
	type Reference,
	type ReferenceKind,
	type ReferenceOccurrence,
	type ResolvedTargets,
	type SaveDraftInput,
	ServiceError,
	type ServiceInput,
	type StorePort,
} from "./types";
import { COLLECTION_FIELD_SCHEMAS as SCHEMA, isCollection } from "../core/collections";

const isJsonArray = (value: unknown): value is readonly JsonValue[] => Array.isArray(value);

function sortKeys(obj: JsonValue): JsonValue {
	if (obj === null || typeof obj !== "object") return obj;
	if (isJsonArray(obj)) return obj.map(sortKeys);
	const record = obj;
	return Object.keys(record)
		.sort()
		.reduce<Record<string, JsonValue>>((acc, key) => {
			const val = record[key];
			if (val !== undefined) acc[key] = sortKeys(val);
			return acc;
		}, {});
}

class ReferenceCollector {
	refs: { kind: ReferenceKind; targetId: string; isStale: boolean; occurrences: ReferenceOccurrence[] }[] = [];

	add(kind: ReferenceKind, targetId: string, occurrence: ReferenceOccurrence, isStale = false) {
		let ref = this.refs.find((r) => r.kind === kind && r.targetId === targetId);
		if (!ref) {
			ref = { kind, targetId, isStale, occurrences: [] };
			this.refs.push(ref);
		} else if (isStale) {
			ref.isStale = true;
		}
		ref.occurrences.push(occurrence);
	}
}

const isValidUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const isValidIsoDate = (s: string) => !Number.isNaN(Date.parse(s));

const SERVICE_INPUT_KEYS: readonly string[] = ["collection", "slug", "metadata", "mdx"];
const SAVE_DRAFT_KEYS: readonly string[] = ["collection", "slug", "metadata", "mdx", "expectedVersion"];

function validateExactRecord(
	value: unknown,
	expectedKeys: readonly string[],
): asserts value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new ServiceError("invalid_input");
	}
	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== null) {
		throw new ServiceError("invalid_input");
	}

	const keys = Reflect.ownKeys(value);
	const expectedSet = new Set(expectedKeys);
	if (keys.length !== expectedSet.size) {
		throw new ServiceError("invalid_input");
	}

	for (const key of keys) {
		if (typeof key !== "string" || !expectedSet.has(key)) {
			throw new ServiceError("invalid_input");
		}
		const desc = Object.getOwnPropertyDescriptor(value, key);
		if (!desc || !desc.enumerable || "get" in desc || "set" in desc || !("value" in desc)) {
			throw new ServiceError("invalid_input");
		}
	}
}

export async function prepareSnapshot(
	input: ServiceInput,
	options?: { schemaVersion?: number; previousReferences?: readonly Reference[] },
): Promise<PreparedSnapshot> {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new ServiceError("invalid_input");
	}
	if (input.folderId === undefined) {
		validateExactRecord(input, SERVICE_INPUT_KEYS);
	} else {
		validateExactRecord(input, [...SERVICE_INPUT_KEYS, "folderId"]);
	}

	const rawCollection: unknown = input.collection;
	if (typeof rawCollection !== "string") {
		throw new ServiceError("invalid_input");
	}
	if (!isCollection(rawCollection)) {
		throw new ServiceError("unknown_collection");
	}
	const rules = SCHEMA[rawCollection];

	if (input.slug !== undefined && input.slug !== null && typeof input.slug !== "string") {
		throw new ServiceError("invalid_input");
	}
	if (typeof input.mdx !== "string") {
		throw new ServiceError("invalid_input");
	}
	if (Buffer.byteLength(input.mdx, "utf8") > 2097152) {
		throw new ServiceError("mdx_too_large");
	}
	let slug = input.slug ? input.slug.trim().normalize("NFC") : null;
	if (slug === "") slug = null;
	if (slug) {
		for (const char of slug) {
			const code = char.codePointAt(0);
			if (code === undefined) continue;
			if (code < 0x20 || code === 0x7f || char === "/" || char === "?" || char === "#") {
				throw new ServiceError("invalid_slug_format");
			}
		}
		if (Array.from(slug).length > 200) {
			throw new ServiceError("slug_too_long");
		}
	}

	if (
		!input.metadata ||
		typeof input.metadata !== "object" ||
		Array.isArray(input.metadata) ||
		(Object.getPrototypeOf(input.metadata) !== Object.prototype && Object.getPrototypeOf(input.metadata) !== null)
	) {
		throw new ServiceError("invalid_input");
	}

	const metaKeys = Reflect.ownKeys(input.metadata);
	for (const key of metaKeys) {
		if (typeof key !== "string") throw new ServiceError("invalid_input");
		const desc = Object.getOwnPropertyDescriptor(input.metadata, key);
		if (!desc?.enumerable || desc.get || desc.set) throw new ServiceError("invalid_input");
	}

	const titleValue = input.metadata.title;
	if (titleValue !== undefined) {
		if (typeof titleValue !== "string") {
			throw new ServiceError("invalid_metadata_type");
		}
		if (Array.from(titleValue).length > 200) {
			throw new ServiceError("title_too_long");
		}
	}

	const metadata: Record<string, string | readonly string[]> = {};
	for (const [k, v] of Object.entries(input.metadata)) {
		if (!Object.hasOwn(rules, k)) {
			throw new ServiceError("invalid_metadata_key");
		}
		const rule = rules[k];
		if (rule === "string") {
			if (typeof v !== "string") throw new ServiceError("invalid_metadata_type");
			metadata[k] = v;
		} else if (rule === "string[]") {
			if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) {
				throw new ServiceError("invalid_metadata_type");
			}
			const arrKeys = Reflect.ownKeys(v);
			if (arrKeys.length !== v.length + 1) {
				throw new ServiceError("invalid_metadata_type");
			}
			for (let i = 0; i < v.length; i++) {
				if (!Object.hasOwn(v, String(i))) throw new ServiceError("invalid_metadata_type");
				const desc = Object.getOwnPropertyDescriptor(v, String(i));
				if (!desc || desc.get || desc.set) throw new ServiceError("invalid_metadata_type");
				if (typeof v[i] !== "string") throw new ServiceError("invalid_metadata_type");
			}
			metadata[k] = Object.freeze([...v]);
		}

		if (k === "policy" && (typeof v !== "string" || !["normal", "evergreen", "deprecated"].includes(v))) {
			throw new ServiceError("invalid_metadata_value");
		}
		if (k === "publishedAt" && (typeof v !== "string" || !isValidIsoDate(v))) {
			throw new ServiceError("invalid_metadata_value");
		}
		if (k === "categoryId" || k === "tagIds" || k === "itemIds") {
			const ids = metadata[k];
			const idsArr = Array.isArray(ids) ? ids : [ids];
			for (const id of idsArr) {
				if (typeof id !== "string" || !isValidUuid(id)) {
					throw new ServiceError("invalid_metadata_value");
				}
			}
		}
	}

	const normalizedMetadataStr = JSON.stringify(sortKeys(metadata));
	if (Buffer.byteLength(normalizedMetadataStr, "utf8") > 262144) {
		throw new ServiceError("metadata_too_large");
	}

	const collector = new ReferenceCollector();
	if (typeof metadata.categoryId === "string") {
		collector.add("category", metadata.categoryId, { type: "metadata", path: "categoryId" });
	}
	if (Array.isArray(metadata.tagIds)) {
		metadata.tagIds.forEach((id, idx) => {
			if (typeof id === "string") {
				collector.add("tag", id, { type: "metadata", path: "tagIds", ordinal: idx });
			}
		});
	}
	if (Array.isArray(metadata.itemIds)) {
		metadata.itemIds.forEach((id, idx) => {
			if (typeof id === "string") {
				collector.add("entry", id, { type: "metadata", path: "itemIds", ordinal: idx });
			}
		});
	}

	let mdxHasError = false;
	const mdxIssues: Issue[] = [];
	const analysis = analyze(input.mdx);

	if (analysis.errors.length > 0) {
		mdxHasError = true;
		for (const e of analysis.errors) {
			mdxIssues.push({ code: "mdx_error", message: e.message });
		}
	}

	const mdxRefsToAdd: { kind: ReferenceKind; targetId: string; occ: ReferenceOccurrence }[] = [];

	type MdxNode = {
		type?: unknown;
		name?: unknown;
		attributes?: unknown;
		children?: unknown;
		position?: { start?: { line?: unknown; column?: unknown } };
	};
	const isMdxNode = (node: unknown): node is MdxNode => {
		return typeof node === "object" && node !== null;
	};

	type MdxAttribute = {
		type?: unknown;
		name?: unknown;
		value?: unknown;
	};
	const isMdxAttribute = (attr: unknown): attr is MdxAttribute => {
		return typeof attr === "object" && attr !== null;
	};

	const traverse = (node: unknown) => {
		if (!isMdxNode(node)) return;
		if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
			if (node.name === "ContentLink" || node.name === "Image") {
				const isContentLink = node.name === "ContentLink";
				const targetAttrKey = isContentLink ? "targetId" : "mediaId";
				const attrs = Array.isArray(node.attributes) ? node.attributes : [];
				const attr = attrs.find((a: unknown): a is MdxAttribute => isMdxAttribute(a) && a.name === targetAttrKey);

				if (!attr) {
					mdxIssues.push({ code: isContentLink ? "empty_reference_id" : "missing_media_id" });
					mdxHasError = true;
				} else if (attr.value === null || attr.value === undefined || attr.value === "") {
					mdxIssues.push({ code: "empty_reference_id" });
					mdxHasError = true;
				} else if (typeof attr.value === "object") {
					mdxIssues.push({ code: "dynamic_reference_id" });
					mdxHasError = true;
				} else if (typeof attr.value !== "string") {
					mdxIssues.push({ code: "dynamic_reference_id" });
					mdxHasError = true;
				} else if (!isValidUuid(attr.value)) {
					mdxIssues.push({ code: "invalid_reference_id" });
					mdxHasError = true;
				} else {
					const pos = node.position?.start;
					mdxRefsToAdd.push({
						kind: isContentLink ? "entry" : "media",
						targetId: attr.value,
						occ: {
							type: "mdx",
							line: typeof pos?.line === "number" ? pos.line : 1,
							column: typeof pos?.column === "number" ? pos.column : 1,
						},
					});
				}
			}
		}
		if (Array.isArray(node.children)) {
			node.children.forEach(traverse);
		}
	};

	traverse(analysis.tree);

	if (mdxHasError) {
		const prevRefs = options?.previousReferences || [];
		for (const ref of prevRefs) {
			for (const occ of ref.occurrences) {
				if (occ.type !== "metadata") {
					collector.add(ref.kind, ref.targetId, { ...occ }, true);
				}
			}
		}
	} else {
		for (const item of mdxRefsToAdd) {
			collector.add(item.kind, item.targetId, item.occ, false);
		}
	}

	const issues: Issue[] = [...mdxIssues];
	if (analysis.frontmatter !== null) {
		issues.push({ code: "frontmatter_present" });
	}

	let schemaVersion = 1;
	if (options?.schemaVersion !== undefined) {
		if (
			typeof options.schemaVersion !== "number" ||
			!Number.isInteger(options.schemaVersion) ||
			options.schemaVersion <= 0
		) {
			throw new ServiceError("invalid_input");
		}
		schemaVersion = options.schemaVersion;
	}
	const tuple = ["cms-snapshot-v1", schemaVersion, sortKeys(metadata), input.mdx];
	const contentHash = createHash("sha256").update(JSON.stringify(tuple)).digest("hex");

	const finalMetadata = Object.freeze(metadata);
	const finalReferences = Object.freeze(
		collector.refs.map((ref) =>
			Object.freeze({
				...ref,
				occurrences: Object.freeze(ref.occurrences.map((o) => Object.freeze({ ...o }))),
			}),
		),
	);
	const finalIssues = Object.freeze(issues.map((i) => Object.freeze({ ...i })));

	return Object.freeze({
		collection: input.collection,
		slug,
		metadata: finalMetadata,
		mdx: input.mdx,
		schemaVersion,
		contentHash,
		references: finalReferences,
		issues: finalIssues,
	});
}

export function validateForPublish(
	snapshot: PreparedSnapshot,
	resolved: ResolvedTargets,
): { ready: boolean; issues: Issue[] } {
	let ready = true;
	const issues: Issue[] = [...snapshot.issues];
	const issueCodes = new Set(issues.map((i) => i.code));

	const addIssue = (code: string) => {
		if (!issueCodes.has(code)) {
			issues.push({ code });
			issueCodes.add(code);
		}
	};

	if (!snapshot.slug) {
		addIssue("null_slug");
	}

	if (["post", "memo", "category", "tag", "collection"].includes(snapshot.collection) && !snapshot.metadata.title) {
		addIssue("missing_title");
	}

	if (["post", "memo"].includes(snapshot.collection) && snapshot.mdx.trim() === "") {
		addIssue("empty_body");
	}

	if (snapshot.collection === "post" && !("categoryId" in snapshot.metadata && snapshot.metadata.categoryId)) {
		addIssue("missing_category");
	}

	if ("categoryId" in snapshot.metadata && typeof snapshot.metadata.categoryId === "string") {
		const categoryId = "categoryId" in snapshot.metadata ? snapshot.metadata.categoryId : undefined;
		const target = resolved.targets.find((t) => t.id === categoryId);
		if (target && target.collection !== "category") {
			addIssue("invalid_reference_collection");
		}
	}
	if ("tagIds" in snapshot.metadata && Array.isArray(snapshot.metadata.tagIds)) {
		for (const id of snapshot.metadata.tagIds) {
			const target = resolved.targets.find((t) => t.id === id);
			if (target && target.collection !== "tag") {
				addIssue("invalid_reference_collection");
			}
		}
	}
	if ("itemIds" in snapshot.metadata && Array.isArray(snapshot.metadata.itemIds)) {
		for (const id of snapshot.metadata.itemIds) {
			const target = resolved.targets.find((t) => t.id === id);
			if (target && target.collection !== "post") {
				addIssue("invalid_item_collection");
			}
		}
	}

	for (const ref of snapshot.references) {
		if (ref.kind === "media") {
			const media = resolved.media.find((m) => m.id === ref.targetId);
			if (!media) {
				addIssue("unresolved_media");
			}
		} else {
			const target = resolved.targets.find((t) => t.id === ref.targetId);
			if (!target) {
				addIssue("unresolved_reference");
			} else {
				if (!target.isPublished) {
					addIssue("unpublished_reference");
				}
			}
		}
	}

	if (issues.length > 0) {
		ready = false;
	}

	return { ready, issues };
}

export const createContentService = <T = unknown>(storePort: StorePort<T>) => {
	return {
		createDraft: async (input: ServiceInput) => {
			if (!input || typeof input !== "object" || Array.isArray(input)) {
				throw new ServiceError("invalid_input");
			}
			if (input.folderId === undefined) {
				validateExactRecord(input, SERVICE_INPUT_KEYS);
			} else {
				validateExactRecord(input, [...SERVICE_INPUT_KEYS, "folderId"]);
			}
			if ("expectedVersion" in input) throw new ServiceError("invalid_input");
			const snapshot = await prepareSnapshot(input);
			return storePort.createEntryWithReferences({
				snapshot,
				references: snapshot.references,
				folderId: input.folderId,
			});
		},
		saveDraft: async (entryId: string, input: SaveDraftInput) => {
			if (!input || typeof input !== "object" || Array.isArray(input)) {
				throw new ServiceError("invalid_input");
			}
			if (input.folderId === undefined) {
				validateExactRecord(input, SAVE_DRAFT_KEYS);
			} else {
				validateExactRecord(input, [...SAVE_DRAFT_KEYS, "folderId"]);
			}

			const expectedVersion = input.expectedVersion;
			if (typeof expectedVersion !== "number" || expectedVersion <= 0 || !Number.isInteger(expectedVersion)) {
				throw new ServiceError("invalid_input");
			}

			let restInput: ServiceInput;
			switch (input.collection) {
				case "post":
					restInput = { collection: "post", slug: input.slug, metadata: input.metadata, mdx: input.mdx };
					break;
				case "memo":
					restInput = { collection: "memo", slug: input.slug, metadata: input.metadata, mdx: input.mdx };
					break;
				case "category":
					restInput = { collection: "category", slug: input.slug, metadata: input.metadata, mdx: input.mdx };
					break;
				case "tag":
					restInput = { collection: "tag", slug: input.slug, metadata: input.metadata, mdx: input.mdx };
					break;
				case "collection":
					restInput = { collection: "collection", slug: input.slug, metadata: input.metadata, mdx: input.mdx };
					break;
				default:
					throw new ServiceError("unknown_collection");
			}

			const previousReferences = await storePort.getWorkingReferences({ entryId });
			const snapshot = await prepareSnapshot(restInput, { previousReferences });
			return storePort.saveWorkingWithReferences({
				entryId,
				expectedVersion,
				snapshot,
				references: snapshot.references,
				folderId: input.folderId,
			});
		},
	};
};
