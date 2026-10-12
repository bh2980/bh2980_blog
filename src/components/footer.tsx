"use client";

import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { LOCALE_INFO, LOCALES, localizePath } from "@/libs/i18n/locales";
import { useTranslate } from "@/libs/i18n/use-locale";

const linkClass =
	"text-foreground underline-offset-[0.22em] hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * 책 맨 뒤 판권 쪽을 한 줄로 줄인 꼬리말. 지은이, 언어판, 받아 보는 곳, 고친 날, 그 아래 작은 저작권 한 줄.
 * 고친 날은 서버에서 구해 넘긴다(`site-footer.tsx`). 없으면 그 칸을 그리지 않는다.
 */
export default function Footer({ lastUpdated }: { lastUpdated?: { iso: string; label: string } }) {
	const { locale, t } = useTranslate();
	return (
		<footer className="mt-auto">
			<div className="mx-auto max-w-page px-6">
				<dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-6 pb-4 text-muted-foreground text-xs sm:grid-cols-4">
					<div>
						<dt>{t("footer.author")}</dt>
						<dd className="text-foreground">bh2980</dd>
					</div>
					<div>
						<dt>{t("footer.edition")}</dt>
						{/* 다른 언어판은 그 언어의 첫 화면으로 간다(글마다 번역본 주소가 달라 같은 글로 바로 가지 않는다) */}
						<dd className="flex flex-wrap gap-x-1.5">
							{LOCALES.map((item, index) => (
								<Fragment key={item}>
									{index > 0 && <span aria-hidden>·</span>}
									{item === locale ? (
										<span aria-current="true" className="text-foreground">
											{LOCALE_INFO[item].nativeName}
										</span>
									) : (
										<Link href={localizePath(item, "/") as Route} hrefLang={item} lang={item} className={linkClass}>
											{LOCALE_INFO[item].nativeName}
										</Link>
									)}
								</Fragment>
							))}
						</dd>
					</div>
					<div>
						<dt>{t("footer.subscribe")}</dt>
						<dd className="flex flex-wrap gap-x-1.5">
							<a
								href={localizePath(locale, "/rss.xml")}
								target="_blank"
								rel="noopener noreferrer"
								className={linkClass}
							>
								{t("footer.rss")}
							</a>
							<span aria-hidden>·</span>
							<a href="https://github.com/bh2980" target="_blank" rel="noopener noreferrer" className={linkClass}>
								GitHub
							</a>
							<span aria-hidden>·</span>
							<a href="https://bh2980.tistory.com/" target="_blank" rel="noopener noreferrer" className={linkClass}>
								{t("footer.tistory")}
							</a>
						</dd>
					</div>
					{lastUpdated && (
						<div>
							<dt>{t("footer.updated")}</dt>
							<dd className="text-foreground tabular-nums">
								<time dateTime={lastUpdated.iso}>{lastUpdated.label}</time>
							</dd>
						</div>
					)}
				</dl>
				<p className="pb-8 text-[11px] text-muted-foreground">{`© ${new Date().getFullYear()} bh2980`}</p>
			</div>
		</footer>
	);
}
