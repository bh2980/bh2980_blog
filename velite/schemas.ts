import { s } from "velite";
import { generateSlugFromFilename, validatePostSlugs } from "./utils";
import { POST_CATEGORIES, MEMO_CATEGORIES } from "@/content/categories";

export const postSchema = s.object({
  title: s.string(),
  slug: s.string().default("").transform(generateSlugFromFilename),
  createdAt: s.isodate(),
  category: s.enum(POST_CATEGORIES),
  tags: s.array(s.string()),
  excerpt: s.excerpt({ length: 80 }),
});

export const seriesSchema = s.object({
  title: s.string(),
  slug: s.string().default("").transform(generateSlugFromFilename),
  description: s.string(),
  postSlugs: s.array(s.string()).refine(validatePostSlugs),
  createdAt: s.isodate(),
});

export const memoSchema = s.object({
  title: s.string(),
  slug: s.string().default("").transform(generateSlugFromFilename),
  createdAt: s.isodate(),
  category: s.enum(MEMO_CATEGORIES),
  tags: s.array(s.string()),
  excerpt: s.excerpt({ length: 80 }),
});
