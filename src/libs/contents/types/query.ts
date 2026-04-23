export type SortDirection = "asc" | "desc";

export type ContentSort = {
	field: "publishedAt" | "title";
	direction: SortDirection;
};

export type PostListQuery = {
	status?: "all" | "published";
	category?: string;
	tag?: string;
	// sort?: ContentSort;
};

export type MemoListQuery = {
	status?: "all" | "published";
	tag?: string;
	// sort?: ContentSort;
};
