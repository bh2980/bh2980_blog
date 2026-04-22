export type SortDirection = "asc" | "desc";

export type ContentSort = {
	field: "publishedAt" | "title";
	direction: SortDirection;
};

export type PostListQuery = {
	status?: "draft" | "published";
	category?: string;
	tag?: string;
	sort?: ContentSort;
};

export type MemoListQuery = {
	tag?: string;
	// sort?: ContentSort;
};
