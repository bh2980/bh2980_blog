import type { Category, Memo, Post, Series, Tag } from "../types/contents";

export interface ContentRepository {
	getPost(slug: string): Promise<Post | null>;
	getMemo(slug: string): Promise<Memo | null>;
	getSeries(slug: string): Promise<Series | null>;
	listPosts(): Promise<Post[]>;
	listPostSlugs(): Promise<string[]>;
	listMemos(): Promise<Memo[]>;
	listMemoSlugs(): Promise<string[]>;
	listCategories(): Promise<Category[]>;
	listTags(): Promise<Tag[]>;
	listSeries(): Promise<Series[]>;
}
