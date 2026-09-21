import { z } from "zod";
import type { Collection } from "@/cms/services/types";

export const collectionSchema = z.enum(["post", "memo", "category", "tag", "collection"]);

export const entryStatusSchema = z.enum(["draft", "published"]);

export const listEntriesQuerySchema = z.object({
	collection: collectionSchema,
	search: z.string().optional(),
	includeBody: z
		.string()
		.optional()
		.transform((val) => val === "true" || val === "1"),
	status: z
		.union([entryStatusSchema, z.array(entryStatusSchema)])
		.optional()
		.transform((val) => {
			if (!val) return undefined;
			return Array.isArray(val) ? val : [val];
		}),
	folderId: z
		.string()
		.nullable()
		.optional()
		.transform((val) => {
			if (val === "null" || val === "") return null;
			return val;
		}),
	includeDescendants: z
		.string()
		.optional()
		.transform((val) => val === "true" || val === "1"),
	sortField: z.enum(["updatedAt", "createdAt", "title", "slug"]).optional(),
	sortDirection: z.enum(["asc", "desc"]).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce
		.number()
		.int()
		.refine((v): v is 25 | 50 | 100 => v === 25 || v === 50 || v === 100, {
			message: "pageSize must be 25, 50, or 100",
		})
		.default(25),
});

export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;

export const createEntryBodySchema = z.object({
	collection: collectionSchema,
	slug: z.string().nullable().optional().default(null),
	metadata: z.record(z.string(), z.unknown()).default({}),
	mdx: z.string().default(""),
	folderId: z.string().uuid().nullable().optional(),
});

export type CreateEntryBody = z.infer<typeof createEntryBodySchema>;

export const patchEntryBodySchema = z.object({
	expectedVersion: z.number({
		error: "version_required",
	}),
	slug: z.string().nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	mdx: z.string().optional(),
	folderId: z.string().uuid().nullable().optional(),
});

export type PatchEntryBody = z.infer<typeof patchEntryBodySchema>;

export const preferencesBodySchema = z.object({
	columnVisibility: z.record(z.string(), z.boolean()).optional(),
	defaultPageSize: z
		.number()
		.refine((v): v is 25 | 50 | 100 => v === 25 || v === 50 || v === 100)
		.optional(),
	sort: z
		.object({
			field: z.enum(["updatedAt", "createdAt", "title", "slug"]),
			direction: z.enum(["asc", "desc"]),
		})
		.optional(),
});

export type PreferencesBody = z.infer<typeof preferencesBodySchema>;
