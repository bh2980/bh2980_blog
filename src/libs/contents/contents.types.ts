export type ListResult<T> = {
	list: T[];
	total: number;
};

type Publication = {
	status: "draft" | "published";
	publishedAt: string | null;
};

type MdxContent = {
	slug: string;
	contentMdx: string;
};

export type Category = { slug: string; label: string };
export type Tag = { slug: string; label: string };

export type Post = MdxContent &
	Publication & {
		title: string;
		excerpt: string;
		category: Category;
		tags: Tag[];
	};

export type Memo = MdxContent &
	Publication & {
		title: string;
		tags: Tag[];
	};

export type Series<T extends MdxContent = MdxContent> = {
	slug: string;
	label: string;
	description?: string;
	items: T[];
};
