"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsAdmin } from "@/libs/admin/use-is-admin";
import { localizePath } from "@/libs/i18n/locales";
import { useTranslate } from "@/libs/i18n/use-locale";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "./theme-toggle";

interface NavigationProps {
	className?: string;
}

const NAV = [
	{ href: "/posts", label: "nav.blog" },
	{ href: "/memos", label: "nav.memos" },
	{ href: "/series", label: "nav.series" },
] as const;

const linkClass =
	"rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** 쪽 머리. 이름과 글 · 메모 · 모음집 세 단어뿐이라 휴대폰에서도 접지 않고 그대로 보인다. */
export default function Navigation({ className }: NavigationProps) {
	const pathname = usePathname();
	const { locale, t } = useTranslate();
	const isAdmin = useIsAdmin();
	// 공개 화면의 언어를 유지한다(v2 B4). 기본 언어는 접두사가 없다.
	const nav = NAV.map((item) => ({ href: localizePath(locale, item.href) as Route, label: t(item.label) }));

	return (
		<header className={className}>
			<div className="mx-auto flex max-w-page items-center justify-between gap-4 px-6 py-5 text-sm">
				<Link href={localizePath(locale, "/") as Route} className={cn(linkClass, "font-semibold hover:text-primary")}>
					bh2980
				</Link>
				<nav className="flex items-center gap-5 text-muted-foreground">
					{isAdmin && (
						<Link href={"/admin" as Route} className={cn(linkClass, "hover:text-foreground")}>
							{t("nav.admin")}
						</Link>
					)}
					{nav.map((item) => {
						const active = pathname?.startsWith(item.href) ?? false;
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={cn(linkClass, "hover:text-foreground", active && "text-foreground")}
							>
								{item.label}
							</Link>
						);
					})}
					<ThemeToggle
						labels={{ toLight: t("theme.toLight"), toDark: t("theme.toDark") }}
						className="-mr-2 size-8 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
					/>
				</nav>
			</div>
		</header>
	);
}
