import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { entryPath } from "@/libs/contents/entry-path";
import { listMemos } from "@/libs/contents/services/memo";
import { listPosts } from "@/libs/contents/services/post";
import { listSeries } from "@/libs/contents/services/series";
import { type Locale, localizePath } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { openGraphLocale, sectionAlternates } from "./i18n-metadata";
import { WORKS, type Work } from "./works";

/** 첫 화면(v2 B4에서 언어를 받도록 옮겼다). 기본 언어 `/`와 `/en`·`/ja`가 함께 쓴다. */
export async function homeMetadata(locale: Locale): Promise<Metadata> {
	return {
		alternates: sectionAlternates(locale, "/"),
		openGraph: { type: "website", siteName: "bh2980.com", ...openGraphLocale(locale) },
	};
}

const COLUMN_ITEMS_COUNT = 3;

type ColumnEntry = { key: string; title: string; description?: string; href: string };

const focusRing = "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** 홈의 한 칸. 제목과 짧은 설명 한 줄씩, 맨 아래에 전체로 가는 링크. */
function Column({
	label,
	entries,
	more,
	empty,
}: {
	label: string;
	entries: ColumnEntry[];
	more?: { href: Route; label: string };
	empty: string;
}) {
	return (
		<section className="flex min-w-0 flex-col gap-3.5">
			<h2 className="font-normal text-muted-foreground text-sm">{label}</h2>
			{entries.length === 0 ? (
				<p className="text-muted-foreground text-sm">{empty}</p>
			) : (
				<ul className="flex flex-col gap-4">
					{entries.map((entry) => (
						<li key={entry.key}>
							<Link href={entry.href as Route} className={`group block ${focusRing}`}>
								<span className="block text-[0.97rem] leading-normal transition-colors group-hover:text-primary">
									{entry.title}
								</span>
								{entry.description && (
									<span className="mt-0.5 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
										{entry.description}
									</span>
								)}
							</Link>
						</li>
					))}
				</ul>
			)}
			{more && entries.length > 0 && (
				<Link
					href={more.href}
					className={`self-start text-muted-foreground text-sm underline decoration-[0.06em] underline-offset-[0.25em] hover:text-foreground ${focusRing}`}
				>
					{more.label}
				</Link>
			)}
		</section>
	);
}

/** 액자 한 점(Lusion식). 작품 쪽 모양은 자유롭고, 홈은 가는 테두리와 설명 한 줄만 그린다. */
function Frontispiece({ work }: { work: Work }) {
	return (
		<figure className="flex flex-col gap-2.5">
			<Link
				href={work.href as Route}
				className={`relative block aspect-video w-full overflow-hidden border bg-muted ${focusRing}`}
			>
				{work.poster ? <Image src={work.poster} alt="" fill sizes="54rem" className="object-cover" /> : null}
			</Link>
			<figcaption className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground text-sm">
				<Link href={work.href as Route} className={`font-semibold text-foreground hover:text-primary ${focusRing}`}>
					{work.title}
				</Link>
				<span>
					{work.tools} · {work.year}
				</span>
			</figcaption>
		</figure>
	);
}

export async function HomeView({ locale }: { locale: Locale }) {
	const t = translator(locale);
	const href = (path: string) => localizePath(locale, path) as Route;
	const [posts, memos, seriesList] = await Promise.all([
		listPosts({}, locale),
		listMemos({}, locale),
		listSeries(locale),
	]);
	const [frontWork] = WORKS;

	const postEntries = posts.list.slice(0, COLUMN_ITEMS_COUNT).map((post) => ({
		key: post.slug,
		title: post.title,
		description: post.excerpt,
		href: entryPath(locale, "post", post.slug),
	}));
	const memoEntries = memos.list.slice(0, COLUMN_ITEMS_COUNT).map((memo) => ({
		key: memo.slug,
		title: memo.title,
		description: memo.tags.map((tag) => tag.label).join(" · "),
		href: entryPath(locale, "memo", memo.slug),
	}));
	const seriesEntries = seriesList.slice(0, COLUMN_ITEMS_COUNT).map((series) => ({
		key: series.slug,
		title: series.label,
		description: series.description,
		href: localizePath(locale, `/series/${series.slug}`),
	}));

	return (
		<div className="mx-auto flex w-full max-w-page flex-col gap-14 px-6 pt-8 pb-20">
			<h1 className="sr-only">bh2980.com</h1>
			{frontWork && <Frontispiece work={frontWork} />}
			<div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
				<Column
					label={t("home.posts")}
					entries={postEntries}
					more={{ href: href("/posts"), label: t("home.allPosts") }}
					empty={t("home.noPosts")}
				/>
				<Column
					label={t("home.memos")}
					entries={memoEntries}
					more={{ href: href("/memos"), label: t("home.allMemos", { count: memos.total }) }}
					empty={t("home.noMemos")}
				/>
				<Column
					label={t("home.series")}
					entries={seriesEntries}
					more={{ href: href("/series"), label: t("home.allSeries") }}
					empty={t("home.noSeries")}
				/>
			</div>
		</div>
	);
}
