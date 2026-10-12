import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { entryPath } from "@/libs/contents/entry-path";
import { SEOUL_TIME_ZONE } from "@/libs/contents/published-at";
import { getSeries, listSeries } from "@/libs/contents/services/series";
import { normalizeSlug } from "@/libs/contents/slug";
import type { Series } from "@/libs/contents/types/contents";
import { type Locale, localizePath } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { openGraphLocale, sectionAlternates } from "./i18n-metadata";

/**
 * 모음집 목록·상세. 기본 언어 주소(`/series`)와 언어 접두사 주소(`/en/series`)가 함께 쓴다.
 * 모음집은 글이나 메모 한 종류를 순서대로 엮은 것이다.
 */

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** 책등 막대 수의 상한. 항목이 아무리 많아도 한 줄을 넘지 않게 한다. */
const MAX_SPINES = 40;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "2-digit",
	timeZone: SEOUL_TIME_ZONE,
});

/** 서울 기준 연·월. 날짜를 읽을 수 없으면 null. */
function yearMonth(value: string): { year: string; month: string } | null {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	const parts = monthFormatter.formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	return year && month ? { year, month } : null;
}

/** 모음집이 걸친 기간. 같은 해면 "2023. 08 – 10", 해가 다르면 "2023. 08 – 2024. 02", 한 달이면 "2024. 01". */
function dateRange(series: Series): string | null {
	const months = series.items
		.map((item) => yearMonth(item.publishedAt))
		.filter((value): value is { year: string; month: string } => value !== null)
		.sort((a, b) => `${a.year}${a.month}`.localeCompare(`${b.year}${b.month}`));
	const first = months[0];
	const last = months[months.length - 1];
	if (!first || !last) return null;
	if (first.year === last.year && first.month === last.month) return `${first.year}. ${first.month}`;
	if (first.year === last.year) return `${first.year}. ${first.month} – ${last.month}`;
	return `${first.year}. ${first.month} – ${last.year}. ${last.month}`;
}

/** 차례의 짧은 날짜 "23. 09". */
function shortDate(value: string): string {
	const parsed = yearMonth(value);
	return parsed ? `${parsed.year.slice(2)}. ${parsed.month}` : "";
}

/** 책등 높이(12~22px). 순서만으로 정해서 서버·클라이언트가 늘 같은 모양을 그린다. */
const spineHeight = (index: number) => 12 + ((index * 7 + 3) % 11);

function countLabel(series: Series, t: ReturnType<typeof translator>): string {
	return t(series.kind === "post" ? "series.postCount" : "series.memoCount", { count: series.items.length });
}

export function seriesListMetadata(locale: Locale): Metadata {
	const t = translator(locale);
	return {
		title: t("series.title"),
		description: t("series.description"),
		alternates: sectionAlternates(locale, "/series"),
		openGraph: openGraphLocale(locale),
	};
}

export async function SeriesListView({ locale }: { locale: Locale }) {
	const t = translator(locale);
	const seriesList = await listSeries(locale);

	return (
		<div className="mx-auto w-full max-w-page px-6 py-12 xl:py-16">
			<h1 className="mb-2 font-bold text-2xl leading-snug">{t("series.title")}</h1>
			<p className="mb-6 text-muted-foreground">{t("series.description")}</p>

			{seriesList.length === 0 ? (
				<p className="text-muted-foreground">{t("series.empty")}</p>
			) : (
				<ul className="m-0 list-none border-b p-0">
					{seriesList.map((series) => {
						const range = dateRange(series);
						return (
							<li key={series.slug} className="border-t">
								<Link
									href={localizePath(locale, `/series/${encodeURIComponent(series.slug)}`) as Route}
									className={`group grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 py-4 ${FOCUS_RING}`}
								>
									<span className="font-bold text-[1.2rem] leading-snug group-hover:text-primary">{series.label}</span>
									<span className="text-right text-muted-foreground text-sm tabular-nums">{countLabel(series, t)}</span>
									{series.description ? (
										<span className="col-start-1 text-muted-foreground text-sm leading-relaxed">
											{series.description}
										</span>
									) : null}
									{range ? (
										<span className="col-start-2 row-start-2 text-right text-muted-foreground text-xs tabular-nums">
											{range}
										</span>
									) : null}
									<span aria-hidden="true" className="col-start-1 mt-1.5 flex h-[22px] items-end gap-0.5">
										{series.items.slice(0, MAX_SPINES).map((item, index) => (
											<i
												key={item.slug}
												className="block w-1 bg-border"
												style={{ height: `${spineHeight(index)}px` }}
											/>
										))}
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

function notFoundMetadata(locale: Locale): Metadata {
	return { title: translator(locale)("site.notFound"), robots: { index: false, follow: true } };
}

export async function seriesDetailMetadata(locale: Locale, slug: string): Promise<Metadata> {
	const series = await getSeries(normalizeSlug(slug), locale);
	if (!series) return notFoundMetadata(locale);

	const url = localizePath(locale, `/series/${encodeURIComponent(series.slug)}`);
	return {
		title: series.label,
		description: series.description,
		alternates: { canonical: url },
		openGraph: {
			title: series.label,
			description: series.description,
			url,
			...openGraphLocale(locale, [locale]),
		},
	};
}

export async function SeriesDetailView({ locale, slug }: { locale: Locale; slug: string }) {
	const series = await getSeries(normalizeSlug(slug), locale);
	if (!series) return notFound();

	const t = translator(locale);
	const items: { slug: string; title: string; publishedAt: string }[] = series.items;

	return (
		<div className="mx-auto w-full max-w-page px-6 py-12 xl:py-16">
			<p className="text-muted-foreground text-sm">
				{t("series.title")} · {countLabel(series, t)}
			</p>
			<h1 className="mt-2 mb-2.5 font-bold text-3xl leading-snug">{series.label}</h1>
			{series.description ? (
				<p className="mb-8 max-w-[32em] text-muted-foreground leading-[1.85]">{series.description}</p>
			) : (
				<div className="mb-8" />
			)}

			{items.length === 0 ? (
				<p className="text-muted-foreground">{t("series.emptyItems")}</p>
			) : (
				<ol className={`m-0 list-none p-0 ${items.length > 10 ? "sm:columns-2 sm:gap-x-10" : ""}`}>
					{items.map((item, index) => (
						<li key={item.slug} className="flex break-inside-avoid items-baseline gap-2.5 py-1.5">
							<span className="w-[1.8em] flex-none text-muted-foreground text-sm tabular-nums">{index + 1}</span>
							<Link
								href={entryPath(locale, series.kind, item.slug) as Route}
								className={`rounded-sm hover:text-primary ${FOCUS_RING}`}
							>
								{item.title}
							</Link>
							<span aria-hidden="true" className="min-w-3 flex-1 -translate-y-1 border-b border-dotted" />
							<span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
								{shortDate(item.publishedAt)}
							</span>
						</li>
					))}
				</ol>
			)}
		</div>
	);
}
