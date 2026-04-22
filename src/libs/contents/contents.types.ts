export type ListResult<T> = {
	list: T[];
	total: number;
};

type Publication = {
	status: "draft" | "published";
	publishedAt: string | null;
};

export type Category = { slug: string; label: string };
export type Tag = { slug: string; label: string };

export type Post = Publication & {
	slug: string;
	title: string;
	contentMdx: string;
	excerpt: string;
	category: Category;
	tags: Tag[];
};

export type Memo = Publication & {
	slug: string;
	title: string;
	contentMdx: string;
	tags: Tag[];
};

export type Series = {
	slug: string;
	label: string;
	description?: string;
	items: Post[];
};
