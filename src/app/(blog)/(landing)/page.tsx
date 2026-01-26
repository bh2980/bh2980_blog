import Link from "next/link";
import Footer from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getMemoList } from "@/libs/contents/memo";
import { getPostList } from "@/libs/contents/post";

export default async function Home() {
	const [posts, memos] = await Promise.all([getPostList(), getMemoList()]);
	const LATEST_ITEMS_COUNT = 3;
	const FEATURED_TAGS_COUNT = 10;
	const latestPosts = posts.list.slice(0, LATEST_ITEMS_COUNT);
	const latestMemos = memos.list.slice(0, LATEST_ITEMS_COUNT);
	const tagCountMap = new Map<string, { slug: string; name: string; count: number }>();

	const allContent = [...posts.list, ...memos.list];

	for (const item of allContent) {
		for (const tag of item.tags ?? []) {
			const existing = tagCountMap.get(tag.slug);
			tagCountMap.set(tag.slug, { slug: tag.slug, name: tag.name, count: (existing?.count ?? 0) + 1 });
		}
	}

	const featuredTags = Array.from(tagCountMap.values())
		.toSorted((a, b) => b.count - a.count)
		.slice(0, FEATURED_TAGS_COUNT);

	return (
		<div className="flex flex-1 flex-col">
			<section className="relative overflow-hidden border-slate-200 border-b bg-linear-to-b from-slate-50 via-white to-white dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
				<div className="absolute inset-0">
					<div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/10" />
					<div className="pointer-events-none absolute right-[-5rem] -bottom-16 h-56 w-56 rounded-full bg-slate-200/60 blur-3xl dark:bg-slate-700/20" />
				</div>
				<div className="relative mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 pt-28 pb-16">
					<Badge
						variant="secondary"
						className="w-fit bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
					>
						개발하면서 써둔 기록들
					</Badge>
					<div className="flex flex-col gap-4">
						<h1 className="font-bold text-4xl text-slate-900 dark:text-slate-100">안녕하세요 👋</h1>
						<p className="text-balance text-lg text-slate-600 dark:text-slate-300">
							개발하다가 배운 것, 해본 것, 까먹기 싫은 것들을 적어두는 곳이에요.
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<Button asChild size="lg">
							<Link href="/posts">블로그 둘러보기</Link>
						</Button>
						<Button asChild variant="outline" size="lg">
							<Link href="/memos">메모 살펴보기</Link>
						</Button>
					</div>
				</div>
			</section>

			<section className="mx-auto w-full max-w-2xl px-6 py-10">
				<div className="grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
					<div className="grid gap-4 sm:grid-cols-3">
						<div>
							<p className="text-slate-500 text-sm dark:text-slate-400">게시글</p>
							<p className="mt-2 font-semibold text-2xl text-slate-900 dark:text-slate-100">{posts.total}</p>
						</div>
						<div>
							<p className="text-slate-500 text-sm dark:text-slate-400">메모</p>
							<p className="mt-2 font-semibold text-2xl text-slate-900 dark:text-slate-100">{memos.total}</p>
						</div>
						<div>
							<p className="text-slate-500 text-sm dark:text-slate-400">태그</p>
							<p className="mt-2 font-semibold text-2xl text-slate-900 dark:text-slate-100">{tagCountMap.size}</p>
						</div>
					</div>
					<Separator />
					<div className="flex flex-wrap gap-2 text-slate-500 text-sm dark:text-slate-400">
						<span>태그는 글과 메모에 함께 사용됩니다.</span>
					</div>
				</div>
			</section>

			<section className="mx-auto w-full max-w-2xl px-6 pb-12">
				<div className="grid gap-10 md:grid-cols-2">
					<div>
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-slate-900 text-xl dark:text-slate-100">최근 글</h2>
							<Link
								href="/posts"
								className="text-slate-500 text-sm hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
							>
								전체 보기
							</Link>
						</div>
						{latestPosts.length === 0 ? (
							<p className="mt-4 text-slate-500 text-sm dark:text-slate-400">아직 작성된 게시글이 없습니다.</p>
						) : (
							<ul className="mt-4 flex flex-col">
								{latestPosts.map((post) => (
									<li key={post.slug} className="group">
										<Separator className="my-1 group-first:hidden" />
										<Link
											href={{ pathname: `/posts/${post.slug}` }}
											className="block rounded-md p-3 transition hover:bg-slate-100 dark:hover:bg-slate-800"
										>
											<div className="flex gap-2 text-slate-500 text-xs dark:text-slate-400">
												<span>{post.category.name}</span>
												<span>·</span>
												<time dateTime={post.publishedDateTimeISO}>{post.publishedAt}</time>
											</div>
											<h3 className="mt-2 line-clamp-2 font-semibold text-slate-900 dark:text-slate-100">
												{post.title}
											</h3>
											<p className="mt-1 line-clamp-2 text-slate-500 text-sm dark:text-slate-400">{post.excerpt}</p>
										</Link>
									</li>
								))}
							</ul>
						)}
					</div>

					<div>
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-slate-900 text-xl dark:text-slate-100">최근 메모</h2>
							<Link
								href="/memos"
								className="text-slate-500 text-sm hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
							>
								전체 보기
							</Link>
						</div>
						{latestMemos.length === 0 ? (
							<p className="mt-4 text-slate-500 text-sm dark:text-slate-400">아직 작성된 메모가 없습니다.</p>
						) : (
							<ul className="mt-4 flex flex-col">
								{latestMemos.map((memo) => (
									<li key={memo.slug} className="group">
										<Separator className="my-1 group-first:hidden" />
										<Link
											href={{ pathname: `/memos/${memo.slug}` }}
											className="block rounded-md p-3 transition hover:bg-slate-100 dark:hover:bg-slate-800"
										>
											<div className="text-slate-500 text-xs dark:text-slate-400">
												<time dateTime={memo.publishedDateTimeISO}>{memo.publishedAt}</time>
											</div>
											<h3 className="mt-2 line-clamp-2 font-semibold text-slate-900 dark:text-slate-100">
												{memo.title}
											</h3>
											{memo.tags?.length ? (
												<ul className="mt-2 flex flex-wrap gap-2 text-slate-500 text-xs dark:text-slate-400 [&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800">
													{memo.tags.map((tag) => (
														<li key={tag.slug}>{`#${tag.name}`}</li>
													))}
												</ul>
											) : (
												<p className="mt-2 text-slate-400 text-xs">태그 없음</p>
											)}
										</Link>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</section>

			<section className="mx-auto w-full max-w-2xl px-6 pb-16">
				<div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/70">
					<div className="flex items-center justify-between">
						<h2 className="font-semibold text-slate-900 text-xl dark:text-slate-100">주요 태그</h2>
					</div>
					<div className="mt-4 flex flex-wrap gap-2">
						{featuredTags.length === 0 ? (
							<p className="text-slate-500 text-sm dark:text-slate-400">아직 태그가 없습니다.</p>
						) : (
							featuredTags.map((tag) => (
								<Badge key={tag.slug} variant="outline" className="gap-1">
									<span>{tag.name}</span>
									<span className="text-slate-400 text-xs">{`(${tag.count})`}</span>
								</Badge>
							))
						)}
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
}
