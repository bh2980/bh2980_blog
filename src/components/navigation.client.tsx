"use client";

import { Menu } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useIsAdmin } from "@/libs/admin/use-is-admin";
import { localizePath } from "@/libs/i18n/locales";
import { useTranslate } from "@/libs/i18n/use-locale";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

interface NavigationProps {
	className?: string;
}

const NAV = [
	{ href: "/posts", label: "nav.blog" },
	{ href: "/memos", label: "nav.memos" },
] as const;

function DesktopLink({ href, label, active }: { href: Route | URL; label: string; active: boolean }) {
	return (
		<Link
			href={href}
			aria-current={active ? "page" : undefined}
			className={cn(
				"rounded-md px-3 py-2 font-medium text-sm transition",
				"text-slate-600 hover:bg-slate-100 hover:text-slate-900",
				"dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:focus-visible:ring-slate-500/60",
				active && "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
			)}
		>
			{label}
		</Link>
	);
}

/** 모바일 메뉴의 링크. 링크 의미를 지키려고 `SheetClose`로 감싸지 않고, 누르면 시트를 닫는다. */
function MobileSheetLink({
	href,
	label,
	active,
	onNavigate,
}: {
	href: Route | URL;
	label: string;
	active: boolean;
	onNavigate: () => void;
}) {
	return (
		<Link
			href={href}
			onClick={onNavigate}
			aria-current={active ? "page" : undefined}
			className={cn(
				"rounded-lg px-3 py-3 font-medium text-base transition",
				"text-slate-700 hover:bg-slate-100",
				"dark:text-slate-200 dark:hover:bg-slate-800",
				active && "bg-slate-100 dark:bg-slate-800",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:focus-visible:ring-slate-500/60",
			)}
		>
			{label}
		</Link>
	);
}

export default function Navigation({ className }: NavigationProps) {
	const pathname = usePathname();
	const { locale, t } = useTranslate();
	const isAdmin = useIsAdmin();
	// 공개 화면의 언어를 유지한다(v2 B4). 기본 언어는 접두사가 없다.
	const nav = NAV.map((item) => ({ href: localizePath(locale, item.href) as Route, label: t(item.label) }));
	const themeLabels = { toLight: t("theme.toLight"), toDark: t("theme.toDark") };
	const [menuOpen, setMenuOpen] = useState(false);
	const closeMenu = () => setMenuOpen(false);

	return (
		<header className={cn("sticky top-0 z-50", className)}>
			<div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 md:px-0">
				<Link
					href={localizePath(locale, "/") as Route}
					className={cn(
						"rounded-md px-2 py-1 font-bold text-lg text-slate-900",
						"hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:focus-visible:ring-slate-500/60",
					)}
				>
					bh2980.dev
				</Link>

				{/* Desktop */}
				<div className="hidden items-center gap-1 md:flex">
					{isAdmin && (
						<Link
							href={"/admin" as Route}
							className={cn(
								"rounded-md px-3 py-2 font-medium text-sm transition",
								"text-slate-600 hover:bg-slate-100 hover:text-slate-900",
								"dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:focus-visible:ring-slate-500/60",
								pathname?.startsWith("/admin") && "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
							)}
						>
							{t("nav.admin")}
						</Link>
					)}
					{nav.map((item) => (
						<DesktopLink
							key={item.href}
							href={item.href}
							label={item.label}
							active={pathname?.startsWith(item.href) ?? false}
						/>
					))}

					<ThemeToggle
						labels={themeLabels}
						className="ml-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
					/>
				</div>

				{/* Mobile */}
				<div className="flex items-center gap-1 md:hidden">
					<ThemeToggle
						labels={themeLabels}
						className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
					/>

					<Sheet open={menuOpen} onOpenChange={setMenuOpen}>
						<SheetTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={t("nav.openMenu")} />}>
							<Menu aria-hidden className="h-5 w-5" />
						</SheetTrigger>

						<SheetContent className="p-0">
							<SheetHeader>
								<SheetTitle>{t("nav.menu")}</SheetTitle>
							</SheetHeader>

							<nav className="px-3 py-3">
								<div className="flex flex-col gap-2">
									{nav.map((item) => (
										<MobileSheetLink
											key={item.href}
											href={item.href}
											label={item.label}
											active={pathname?.startsWith(item.href) ?? false}
											onNavigate={closeMenu}
										/>
									))}
									{isAdmin && (
										<Link
											href={"/admin" as Route}
											onClick={closeMenu}
											className={cn(
												"rounded-lg px-3 py-3 font-medium text-base transition",
												"text-slate-700 hover:bg-slate-100",
												"dark:text-slate-200 dark:hover:bg-slate-800",
												pathname?.startsWith("/admin") && "bg-slate-100 dark:bg-slate-800",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:focus-visible:ring-slate-500/60",
											)}
										>
											{t("nav.admin")}
										</Link>
									)}
								</div>
							</nav>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
}
