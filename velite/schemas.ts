import { s } from "velite";
import { generateSlugFromFilename, getContentFilePathArray, getKoreaISOTimeText, validatePostSlugs } from "./utils";
import { POST_CATEGORIES, MEMO_CATEGORIES } from "@/content/categories";

const contentSchema = s.object({
  title: s.string(),
  slug: s.string().default("").transform(generateSlugFromFilename),
  createdAt: s.isodate().default(getKoreaISOTimeText()),
  path: s.array(s.string()).default([]).transform(getContentFilePathArray),
});

export const postSchema = contentSchema.extend({
  category: s.enum(POST_CATEGORIES),
  tags: s.array(s.string()),
  excerpt: s.excerpt({ length: 80 }),
});

export const seriesSchema = contentSchema.extend({
  description: s.string(),
  postSlugs: s.array(s.string()).refine(validatePostSlugs),
});

export const memoSchema = contentSchema.extend({
  category: s.enum(MEMO_CATEGORIES),
  tags: s.array(s.string()),
  excerpt: s.excerpt({ length: 80 }),
});
