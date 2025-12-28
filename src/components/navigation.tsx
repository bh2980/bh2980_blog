"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

interface NavigationProps {
	className?: string;
}

export default function Navigation({ className }: NavigationProps) {
	const [theme, setTheme] = useState<string | undefined>(undefined);

	useEffect(() => {
		const savedTheme = localStorage.getItem("theme");
		if (savedTheme) {
			setTheme(savedTheme);
			document.documentElement.classList.add(savedTheme);
		} else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
			setTheme("dark");
			document.documentElement.classList.add("dark");
		} else {
			setTheme("light");
		}
	}, []);

	const toggleTheme = () => {
		if (theme === "dark") {
			document.documentElement.classList.remove("dark");
			localStorage.setItem("theme", "light");
			setTheme("light");
		} else {
			document.documentElement.classList.add("dark");
			localStorage.setItem("theme", "dark");
			setTheme("dark");
		}
	};

	return (
		<nav className={cn(className)}>
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					<Link
						href="/"
						className="font-bold text-gray-900 text-xl hover:text-gray-700 dark:text-gray-100 dark:hover:text-gray-300"
					>
						bh2980.dev
					</Link>

					{/* 데스크톱 메뉴 */}
					<div className="hidden items-center space-x-8 md:flex">
						<div className="flex space-x-6">
							<Link
								href="/"
								className="font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
							>
								홈
							</Link>
							<Link
								href="/posts"
								className="font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
							>
								블로그
							</Link>
							<Link
								href="/memos"
								className="font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
							>
								메모장
							</Link>
						</div>
						<button
							onClick={toggleTheme}
							className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
							aria-label="다크 모드 토글"
							type="button"
						>
							{theme === "dark" ? (
								<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z"
									/>
								</svg>
							) : (
								<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 3v1m0 16v1m9-9h1M4 12H3m15.325 5.325l-.707.707M6.364 6.364l-.707-.707m12.728 0l-.707-.707M6.364 17.636l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
									/>
								</svg>
							)}
						</button>
					</div>
				</div>
			</div>
		</nav>
	);
}
