import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { QueryPreservingBackLink } from "@/components/query-preserving-back-link.client";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";

export const MemoBackLink = ({
	pathname = "/memos",
	locale = DEFAULT_LOCALE,
}: {
	pathname?: string;
	locale?: Locale;
}) => {
	const t = translator(locale);
	return (
		<Suspense
			fallback={
				<nav aria-label={t("detail.backNav")} className="hidden md:block">
					<Link
						href={pathname as Route}
						className="flex items-center gap-1 text-slate-500 text-sm hover:underline dark:text-slate-400"
					>
						<ArrowLeft size={14} />
						<span>{t("detail.back")}</span>
					</Link>
				</nav>
			}
		>
			<nav aria-label={t("detail.backNav")} className="hidden md:block">
				<QueryPreservingBackLink
					pathname={pathname}
					iconSize={14}
					className="flex items-center gap-1 text-slate-500 text-sm hover:underline dark:text-slate-400"
				/>
			</nav>
		</Suspense>
	);
};
