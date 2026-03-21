import { Suspense } from "react";
import type { Post } from "@/libs/contents/types";
import { PostDetailNavigationClient } from "./client";

type PostDetailNavigationProps = {
	currentSlug: string;
	items: Omit<Post, "content">[];
	detailPathnamePrefix?: string;
};

export const PostDetailNavigation = ({
	currentSlug,
	items,
	detailPathnamePrefix = "/posts",
}: PostDetailNavigationProps) => {
	return (
		<Suspense
			fallback={
				<>
					<hr className="border-slate-200 dark:border-slate-800" />
					<div aria-hidden="true" className="h-[5.5rem]" />
				</>
			}
		>
			<PostDetailNavigationClient
				currentSlug={currentSlug}
				items={items}
				detailPathnamePrefix={detailPathnamePrefix}
			/>
		</Suspense>
	);
};
