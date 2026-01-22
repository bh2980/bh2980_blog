"use client";

import { Menu, Moon, Sun } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/utils/cn";
import { Button } from "./ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

interface NavigationProps {
	className?: string;
}

const NAV = [
	{ href: "/posts", label: "블로그" },
	{ href: "/memos", label: "메모장" },
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

function MobileSheetLink({ href, label, active }: { href: Route | URL; label: string; active: boolean }) {
	return (
		<SheetClose asChild>
			<Link
				href={href}
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
		</SheetClose>
	);
}

export default function Navigation({ className }: NavigationProps) {
	const pathname = usePathname();
	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const toggleTheme = () => setTheme(isDark ? "light" : "dark");

	return (
		<header
			className={cn(
				"sticky top-0 z-50 border-slate-200/70 border-b bg-white/80 backdrop-blur",
				"dark:border-slate-800/70 dark:bg-slate-950/70",
				className,
			)}
		>
			<div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
				<Link
					href="/"
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
					{NAV.map((item) => (
						<DesktopLink
							key={item.href}
							href={item.href}
							label={item.label}
							active={pathname?.startsWith(item.href) ?? false}
						/>
					))}

					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={toggleTheme}
						aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
						className="ml-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
					>
						{isDark ? <Moon aria-hidden className="h-5 w-5" /> : <Sun aria-hidden className="h-5 w-5" />}
					</Button>
				</div>

				{/* Mobile */}
				<div className="flex items-center gap-1 md:hidden">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={toggleTheme}
						aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
						className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
					>
						{isDark ? <Moon aria-hidden className="h-5 w-5" /> : <Sun aria-hidden className="h-5 w-5" />}
					</Button>

					<Sheet>
						<SheetTrigger asChild>
							<Button type="button" variant="ghost" size="icon" aria-label="메뉴 열기">
								<Menu aria-hidden className="h-5 w-5" />
							</Button>
						</SheetTrigger>

						<SheetContent className="p-0">
							<SheetHeader>
								<SheetTitle>메뉴</SheetTitle>
							</SheetHeader>

							<nav className="px-3 py-3">
								<div className="flex flex-col gap-2">
									{NAV.map((item) => (
										<MobileSheetLink
											key={item.href}
											href={item.href}
											label={item.label}
											active={pathname?.startsWith(item.href) ?? false}
										/>
									))}
								</div>
							</nav>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
}
