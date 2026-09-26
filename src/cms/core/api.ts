import { z } from "zod";
import { COLLECTIONS } from "./collections";

/**
 * `/api/cms/v1` 요청 계약. 라우트·관리자 UI·OpenAPI가 같은 정의를 본다(`docs/cms/openapi.yaml`).
 */

export const collectionSchema = z.enum(COLLECTIONS);

export const ENTRY_STATUSES = ["draft", "published", "archived", "trashed"] as const;
export const entryStatusSchema = z.enum(ENTRY_STATUSES);

export const LIST_SORT_FIELDS = ["updatedAt", "createdAt", "publishedAt", "title", "slug"] as const;
export type ListSortField = (typeof LIST_SORT_FIELDS)[number];
export const listSortFieldSchema = z.enum(LIST_SORT_FIELDS);
export const sortDirectionSchema = z.enum(["asc", "desc"]);

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
const pageSizeSchema = z.coerce
	.number()
	.int()
	.refine((v): v is PageSize => (PAGE_SIZES as readonly number[]).includes(v), {
		message: "pageSize must be 25, 50, or 100",
	});

const booleanQuery = z
	.enum(["true", "false", "1", "0"])
	.optional()
	.transform((val) => (val === undefined ? undefined : val === "true" || val === "1"));
const dateQuery = z.iso
	.datetime({ offset: true })
	.optional()
	.transform((val) => (val ? new Date(val) : undefined));

/** 같은 키를 여러 번 쓸 수 있는 목록 질의 키. 라우트는 이 키만 `getAll`로 읽는다. */
export const LIST_ARRAY_QUERY_KEYS = ["status", "tagId", "categoryId"] as const;

export const listEntriesQuerySchema = z.object({
	collection: collectionSchema,
	search: z.string().optional(),
	includeBody: booleanQuery,
	titleContains: z.string().optional(),
	slugContains: z.string().optional(),
	status: z.array(entryStatusSchema).optional(),
	folderId: z
		.string()
		.optional()
		.transform((val) => (val === undefined ? undefined : val === "null" || val === "" ? null : val))
		.pipe(z.union([z.uuid(), z.null(), z.undefined()])),
	includeDescendants: booleanQuery,
	tagId: z.array(z.uuid()).optional(),
	categoryId: z.array(z.uuid()).optional(),
	hasChanges: booleanQuery,
	scheduled: booleanQuery,
	createdFrom: dateQuery,
	createdTo: dateQuery,
	updatedFrom: dateQuery,
	updatedTo: dateQuery,
	publishedFrom: dateQuery,
	publishedTo: dateQuery,
	sortField: listSortFieldSchema.optional(),
	sortDirection: sortDirectionSchema.optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: pageSizeSchema.default(25),
});
export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;

const expectedVersionSchema = z.number().int().positive();

export const createEntryBodySchema = z.object({
	collection: collectionSchema,
	slug: z.string().nullable().optional().default(null),
	metadata: z.record(z.string(), z.unknown()).default({}),
	mdx: z.string().default(""),
	folderId: z.uuid().nullable().optional(),
});
export type CreateEntryBody = z.infer<typeof createEntryBodySchema>;

export const patchEntryBodySchema = z.object({
	expectedVersion: expectedVersionSchema,
	slug: z.string().nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	mdx: z.string().optional(),
	folderId: z.uuid().nullable().optional(),
});
export type PatchEntryBody = z.infer<typeof patchEntryBodySchema>;

/** 버전만 받는 상태 전환(발행·보관·보관 해제·휴지통·복원). 발행일은 초안 메타데이터의 `publishedAt`이다. */
export const versionBodySchema = z.object({ expectedVersion: expectedVersionSchema });

export const scheduleBodySchema = z.object({
	expectedVersion: expectedVersionSchema,
	scheduledAt: z.iso.datetime({ offset: true }),
});

export const BULK_OPS = [
	"tags.add",
	"tags.remove",
	"category.set",
	"folder.move",
	"archive",
	"unarchive",
	"trash",
	"publish",
	"permanentDelete",
] as const;
export type BulkOp = (typeof BULK_OPS)[number];

export const bulkBodySchema = z.object({
	op: z.enum(BULK_OPS),
	items: z.array(z.object({ id: z.uuid(), expectedVersion: expectedVersionSchema })).max(100),
	tagIds: z.array(z.uuid()).optional(),
	categoryId: z.uuid().nullable().optional(),
	folderId: z.uuid().nullable().optional(),
});
export type BulkBody = z.infer<typeof bulkBodySchema>;

export const ADMIN_LIST_COLUMNS = [
	"title",
	"status",
	"category",
	"tags",
	"updatedAt",
	"publishedAt",
	"createdAt",
	"slug",
	"folder",
] as const;
export const adminListColumnSchema = z.enum(ADMIN_LIST_COLUMNS);
export type AdminListColumn = z.infer<typeof adminListColumnSchema>;

export const adminColumnSettingsSchema = z
	.object({
		order: z.array(adminListColumnSchema).max(ADMIN_LIST_COLUMNS.length).optional(),
		visibility: z.record(z.string(), z.boolean()).optional(),
	})
	.superRefine((settings, ctx) => {
		if (settings.order && new Set(settings.order).size !== settings.order.length) {
			ctx.addIssue({ code: "custom", message: "Column order cannot contain duplicates", path: ["order"] });
		}
		for (const key of Object.keys(settings.visibility ?? {})) {
			if (!adminListColumnSchema.safeParse(key).success) {
				ctx.addIssue({ code: "custom", message: `Unknown column: ${key}`, path: ["visibility", key] });
			}
		}
	});
export type AdminColumnSettings = z.infer<typeof adminColumnSettingsSchema>;

export const MAX_SAVED_VIEWS = 20;

/**
 * 이름 붙인 저장된 보기(v2 A4). `query`는 목록 URL의 검색·필터·정렬 부분이며 폴더·페이지는 담지 않는다.
 * 배열 순서가 표시 순서다.
 */
export const savedViewSchema = z.object({
	id: z.string().trim().min(1).max(64),
	name: z.string().trim().min(1).max(60),
	query: z.string().max(2000),
	columns: adminColumnSettingsSchema.optional(),
});
export type SavedView = z.infer<typeof savedViewSchema>;

/** 컬렉션별 목록 설정(§3.2 "컬럼 설정·페이지 크기는 컬렉션별 사용자 설정에 저장"). */
export const collectionPreferencesSchema = z.object({
	columns: adminColumnSettingsSchema.optional(),
	pageSize: pageSizeSchema.optional(),
	sort: z.object({ field: listSortFieldSchema, direction: sortDirectionSchema }).optional(),
	views: z
		.array(savedViewSchema)
		.max(MAX_SAVED_VIEWS)
		.superRefine((views, ctx) => {
			if (new Set(views.map((view) => view.id)).size !== views.length) {
				ctx.addIssue({ code: "custom", message: "View ids must be unique" });
			}
		})
		.optional(),
});
export type CollectionPreferences = z.infer<typeof collectionPreferencesSchema>;

export const preferencesBodySchema = z.object({
	collections: z.partialRecord(collectionSchema, collectionPreferencesSchema).optional(),
	/** 편집 화면의 패널 접힘 상태. */
	editor: z.object({ inspectorOpen: z.boolean().optional() }).optional(),
});
export type PreferencesBody = z.infer<typeof preferencesBodySchema>;

export const exportScopeSchema = z.object({
	scope: z.enum(["admin", "public"]).default("admin"),
});
export type ExportScopeInput = z.infer<typeof exportScopeSchema>;

export const templateCollectionSchema = z.enum(["post", "memo"]);

export const createTemplateBodySchema = z.object({
	name: z.string().trim().min(1).max(100),
	forCollection: templateCollectionSchema,
	mdx: z.string().default(""),
});
export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;

export const patchTemplateBodySchema = z.object({
	expectedVersion: expectedVersionSchema,
	name: z.string().trim().min(1).max(100).optional(),
	forCollection: templateCollectionSchema.optional(),
	mdx: z.string().optional(),
});
export type PatchTemplateBody = z.infer<typeof patchTemplateBodySchema>;

const folderNameSchema = z.string().trim().min(1).max(100);

export const createFolderBodySchema = z.object({
	collection: collectionSchema,
	name: folderNameSchema,
	parentId: z.uuid().nullable().optional().default(null),
	position: z.number().int().min(0).optional().default(0),
});

export const updateFolderBodySchema = z.object({
	expectedVersion: expectedVersionSchema,
	name: folderNameSchema.optional(),
	parentId: z.uuid().nullable().optional(),
	position: z.number().int().min(0).optional(),
});

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 40_000_000;

const uploadFileSchema = z.object({
	mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
	byteSize: z.number().int().positive(),
});

/**
 * 업로드 준비(§7.2). 웹용 최적화를 고르면 브라우저가 만든 공개용 파일(`mimeType`·`byteSize`)과
 * 원본 파일(`original`)을 같은 미디어 레코드로 함께 올린다.
 */
export const mediaUploadBodySchema = uploadFileSchema.extend({
	filename: z.string().trim().min(1).max(255),
	original: uploadFileSchema.optional(),
});
export type MediaUploadBody = z.infer<typeof mediaUploadBodySchema>;

export const mediaPatchBodySchema = z.object({
	defaultAlt: z.string().max(1000).optional(),
	defaultCaption: z.string().max(1000).optional(),
});

export const mediaListQuerySchema = z.object({
	search: z.string().optional(),
	mimeType: z.string().optional(),
	used: z.enum(["all", "used", "unused"]).default("all"),
	uploadedFrom: dateQuery,
	uploadedTo: dateQuery,
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
