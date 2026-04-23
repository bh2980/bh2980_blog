import type { Category, Memo, Post, Series, Tag } from "../types/contents";
import type { MemoListQuery, PostListQuery } from "../types/query";

export interface ContentRepository {
	getPost(slug: string): Promise<Post | null>;
	getMemo(slug: string): Promise<Memo | null>;
	getSeries(slug: string): Promise<Series | null>;
	listPosts(query: PostListQuery): Promise<Post[]>;
	listPostSlugs(): Promise<string[]>;
	listMemos(query: MemoListQuery): Promise<Memo[]>;
	listMemoSlugs(): Promise<string[]>;
	listCategories(): Promise<Category[]>;
	listTags(): Promise<Tag[]>;
	listSeries(): Promise<Series[]>;
}
