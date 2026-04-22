import type { Category, ListResult, Memo, Post, Series, Tag } from "./contents.types";

export interface ContentRepository {
	getPost(slug: string): Promise<Post | null>;
	getMemo(slug: string): Promise<Memo | null>;
	getSeries(slug: string): Promise<Series | null>;
	listPosts(): Promise<ListResult<Post>>;
	listMemos(): Promise<ListResult<Memo>>;
	listCategories(): Promise<ListResult<Category>>;
	listTags(): Promise<ListResult<Tag>>;
	listSeries(): Promise<ListResult<Series>>;
}
