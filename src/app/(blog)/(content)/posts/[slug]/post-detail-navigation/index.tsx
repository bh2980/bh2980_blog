import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import type { Post } from "@/libs/contents/types";
import { PostDetailNavigationClient } from "./client";

type PostDetailNavigationProps = {
	currentSlug: string;
	items: Omit<Post, "content">[];
	prevPost: Omit<Post, "content"> | null;
	nextPost: Omit<Post, "content"> | null;
	detailPathnamePrefix?: string;
	listPathname?: string;
};

export const PostDetailNavigation = ({
	currentSlug,
	items,
	prevPost,
	nextPost,
	detailPathnamePrefix = "/posts",
	listPathname = "/posts",
}: PostDetailNavigationProps) => {
	return (
		<Suspense
			fallback={
				<>
					<hr className="border-slate-200 dark:border-slate-800" />
					<nav aria-label="상세 페이지 이동" className="flex flex-col gap-6">
						<div className="hidden md:block">
							<Link
								href={listPathname as Route}
								className="flex items-center gap-1 text-slate-500 hover:underline dark:text-slate-400"
							>
								<ArrowLeft size={16} />
								<span>돌아가기</span>
							</Link>
						</div>
						<div className="flex">
							{prevPost && (
								<Link
									href={`${detailPathnamePrefix}/${sanitizeSlug(prevPost.slug)}` as Route}
									className="flex flex-col gap-2 hover:underline"
								>
									<span className="inline-flex items-center gap-1 text-sm">
										<ChevronLeft size={16} />
										이전 글
									</span>
									<span>{prevPost.title}</span>
								</Link>
							)}

							{nextPost && (
								<Link
									href={`${detailPathnamePrefix}/${sanitizeSlug(nextPost.slug)}` as Route}
									className="ml-auto flex flex-col justify-end gap-2 hover:underline"
								>
									<span className="inline-flex items-center justify-end gap-1 text-sm">
										다음 글
										<ChevronRight size={16} />
									</span>
									<span>{nextPost.title}</span>
								</Link>
							)}
						</div>
					</nav>
				</>
			}
		>
			<PostDetailNavigationClient
				currentSlug={currentSlug}
				items={items}
				detailPathnamePrefix={detailPathnamePrefix}
				listPathname={listPathname}
			/>
		</Suspense>
	);
};
