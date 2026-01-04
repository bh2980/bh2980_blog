"use client";

import Giscus from "@giscus/react";
import { useTheme } from "next-themes";
import { sanitizeSlug } from "@/keystatic/libs/slug";

export const Comments = ({ slug }: { slug: string }) => {
	const { resolvedTheme } = useTheme();

	return (
		<Giscus
			id="comments"
			repo={`${process.env.NEXT_PUBLIC_KEYSTATIC_OWNER}/${process.env.NEXT_PUBLIC_KEYSTATIC_REPO}`}
			repoId={process.env.NEXT_PUBLIC_GISUS_REPO_ID}
			category="Comments"
			categoryId={process.env.NEXT_PUBLIC_GISUS_CATEGORY_ID}
			mapping="specific"
			term={sanitizeSlug(slug)}
			reactionsEnabled="1"
			emitMetadata="0"
			inputPosition="top"
			lang="ko"
			loading="lazy"
			theme={resolvedTheme === "dark" ? "dark_protanopia" : "light_protanopia"}
		/>
	);
};
