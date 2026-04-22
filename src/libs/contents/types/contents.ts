export type ListResult<T> = {
	list: T[];
	total: number;
};

type Publication =
	| {
			status: "published";
			publishedAt: string;
	  }
	| {
			status: "draft";
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
	isEvergreen?: boolean;
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
