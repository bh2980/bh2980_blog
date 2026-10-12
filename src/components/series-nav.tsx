import type { Route } from "next";
import Link from "next/link";
import { entryPath } from "@/libs/contents/entry-path";
import type { SeriesPlace } from "@/libs/contents/services/series";
import { type Locale, localizePath } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";

/** 글머리에 붙는 모음집 막대: 모음집 이름(왼쪽)과 "n / m"(오른쪽), 아래에 가는 선. */
export function SeriesBar({ place, locale }: { place: SeriesPlace; locale: Locale }) {
	const t = translator(locale);

	return (
		<div className="not-prose mb-8 flex items-baseline justify-between gap-4 border-b pb-3 text-sm">
			<Link
				href={localizePath(locale, `/series/${place.series.slug}`) as Route}
				className="font-semibold text-foreground hover:underline"
			>
				{place.series.label}
			</Link>
			<span className="text-muted-foreground tabular-nums">
				{t("series.position", { index: place.index, total: place.total })}
			</span>
		</div>
	);
}

/** 글 끝의 모음집 이동: 한 줄에 앞 / 가운데(모음집 · 위치) / 다음. 좁은 화면에서는 가운데가 위 줄로 올라간다. */
export function SeriesPager({ place, locale }: { place: SeriesPlace; locale: Locale }) {
	const t = translator(locale);
	const href = (slug: string) => entryPath(locale, place.series.kind, slug) as Route;

	return (
		<nav
			aria-label={t("series.navLabel")}
			className="not-prose grid grid-cols-2 items-baseline gap-x-6 gap-y-3 border-t pt-6 text-sm md:grid-cols-[1fr_auto_1fr]"
		>
			<Link
				href={localizePath(locale, `/series/${place.series.slug}`) as Route}
				className="order-first col-span-2 text-center text-muted-foreground tabular-nums hover:text-foreground md:order-none md:col-span-1 md:col-start-2 md:row-start-1"
			>
				{place.series.label} · {t("series.position", { index: place.index, total: place.total })}
			</Link>
			{place.prev ? (
				<Link
					href={href(place.prev.slug)}
					aria-label={`${t("series.prev")}: ${place.prev.title}`}
					className="group flex min-w-0 gap-2 text-foreground md:col-start-1 md:row-start-1"
				>
					<span aria-hidden className="text-muted-foreground">
						←
					</span>
					<span className="min-w-0 group-hover:underline">{place.prev.title}</span>
				</Link>
			) : (
				<span aria-hidden />
			)}
			{place.next ? (
				<Link
					href={href(place.next.slug)}
					aria-label={`${t("series.next")}: ${place.next.title}`}
					className="group col-start-2 flex min-w-0 justify-end gap-2 text-right text-foreground md:col-start-3 md:row-start-1"
				>
					<span className="min-w-0 group-hover:underline">{place.next.title}</span>
					<span aria-hidden className="text-muted-foreground">
						→
					</span>
				</Link>
			) : null}
		</nav>
	);
}
