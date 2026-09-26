"use client";

import { Menu } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsAdmin } from "@/libs/admin/use-is-admin";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "./theme-toggle";
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
		<SheetClose
			nativeButton={false}
			render={
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
				/>
			}
		>
			{label}
		</SheetClose>
	);
}

export default function Navigation({ className }: NavigationProps) {
	const pathname = usePathname();
	const isAdmin = useIsAdmin();

	return (
		<header className={cn("sticky top-0 z-50", className)}>
			<div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 md:px-0">
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
							관리자
						</Link>
					)}
					{NAV.map((item) => (
						<DesktopLink
							key={item.href}
							href={item.href}
							label={item.label}
							active={pathname?.startsWith(item.href) ?? false}
						/>
					))}

					<ThemeToggle className="ml-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100" />
				</div>

				{/* Mobile */}
				<div className="flex items-center gap-1 md:hidden">
					<ThemeToggle className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100" />

					<Sheet>
						<SheetTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="메뉴 열기" />}>
							<Menu aria-hidden className="h-5 w-5" />
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
									{isAdmin && (
										<SheetClose
											nativeButton={false}
											render={
												<Link
													href={"/admin" as Route}
													className={cn(
														"rounded-lg px-3 py-3 font-medium text-base transition",
														"text-slate-700 hover:bg-slate-100",
														"dark:text-slate-200 dark:hover:bg-slate-800",
														pathname?.startsWith("/admin") && "bg-slate-100 dark:bg-slate-800",
														"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:focus-visible:ring-slate-500/60",
													)}
												/>
											}
										>
											관리자
										</SheetClose>
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
