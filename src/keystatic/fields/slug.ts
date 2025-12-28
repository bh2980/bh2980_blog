import { fields } from "@keystatic/core";
import { getKoreanSlug } from "../libs/slug";

export const slug = (_args: Parameters<typeof fields.slug>[0]) => {
	return fields.slug({
		name: _args?.name,
		slug: {
			..._args?.slug,
			generate: _args.slug?.generate ?? getKoreanSlug,
		},
	});
};
