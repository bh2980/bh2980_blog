export type ListResult<T> = {
	list: T[];
	total: number;
};

export type DraftState = {
	status: "draft";
};

export type PublishedState = {
	status: "published";
	publishedAt: string;
};

export type Category = { slug: string; label: string };
export type Tag = { slug: string; label: string };

type BasePost = {
	slug: string;
	title: string;
	contentMdx: string;
	excerpt: string;
	category: Category;
	tags: Tag[];
	isEvergreen?: boolean;
};

export type DraftPost = DraftState & BasePost;
export type PublishedPost = PublishedState & BasePost;
export type Post = DraftPost | PublishedPost;

type BaseMemo = {
	slug: string;
	title: string;
	contentMdx: string;
	tags: Tag[];
};

export type DraftMemo = DraftState & BaseMemo;
export type PublishedMemo = PublishedState & BaseMemo;
export type Memo = DraftMemo | PublishedMemo;

export type Series = {
	slug: string;
	label: string;
	description?: string;
	items: Post[];
};
