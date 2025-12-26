export const getKoreanSlug = (name: string) =>
	name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\w\uAC00-\uD7A3-]+/g, "");
