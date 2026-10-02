import { Languages } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { LOCALE_INFO, LOCALES, type Locale } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { cn } from "@/utils/cn";

/**
 * 글 화면의 언어 전환(v2 B4). 공개된 번역본이 있는 언어만 보인다. 브라우저 언어로 자동 이동하지 않는다.
 * 링크 이름은 그 언어로 쓴 언어 이름이다(`English`, `日本語`).
 */
export function LanguageLinks({
	current,
	links,
	className,
}: {
	current: Locale;
	links: readonly { locale: Locale; href: string }[];
	className?: string;
}) {
	const others = LOCALES.flatMap((locale) => {
		if (locale === current) return [];
		const link = links.find((item) => item.locale === locale);
		return link ? [link] : [];
	});
	if (others.length === 0) return null;
	const t = translator(current);

	return (
		<nav
			aria-label={t("language.switch")}
			className={cn("not-prose flex items-center gap-2 text-slate-500 text-xs dark:text-slate-400", className)}
		>
			<Languages aria-hidden className="size-3.5" />
			<ul className="flex flex-wrap items-center gap-2">
				{others.map((link) => (
					<li key={link.locale}>
						<Link
							href={link.href as Route}
							hrefLang={link.locale}
							lang={link.locale}
							className="rounded-full border border-slate-200 px-2.5 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
						>
							{LOCALE_INFO[link.locale].nativeName}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
