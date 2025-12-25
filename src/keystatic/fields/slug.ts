import { fields } from "@keystatic/core";

const koreanSlugGenerator = (name: string) =>
	name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-") // 공백을 하이픈으로
		.replace(/[^\w\uAC00-\uD7A3-]+/g, "");

export const slug = (_args: Parameters<typeof fields.slug>[0]) => {
	return fields.slug({
		name: _args?.name,
		slug: {
			..._args?.slug,
			generate: _args.slug?.generate ?? koreanSlugGenerator,
		},
	});
};
