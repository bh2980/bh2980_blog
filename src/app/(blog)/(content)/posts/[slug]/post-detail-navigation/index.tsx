import { Suspense } from "react";
import type { Post } from "@/libs/contents/types/contents";
import { PostDetailNavigationClient } from "./client";

type PostDetailNavigationProps = {
	currentSlug: string;
	items: Post[];
	detailPathnamePrefix?: string;
};

export const PostDetailNavigation = ({
	currentSlug,
	items,
	detailPathnamePrefix = "/posts",
}: PostDetailNavigationProps) => {
	return (
		<Suspense fallback={<div aria-hidden="true" className="h-14 border-t" />}>
			<PostDetailNavigationClient currentSlug={currentSlug} items={items} detailPathnamePrefix={detailPathnamePrefix} />
		</Suspense>
	);
};
