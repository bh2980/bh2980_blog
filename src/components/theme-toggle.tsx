"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type ComponentProps, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 밝은·어두운 테마 전환 버튼. 서버 렌더에서는 `resolvedTheme`을 알 수 없으므로
 * 아이콘은 `dark:` 클래스로 바꾸고, 라벨은 마운트한 뒤에만 현재 테마를 반영한다(hydration 불일치 방지).
 */
export function ThemeToggle({ className, ...props }: Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const isDark = resolvedTheme === "dark";

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			aria-label={mounted ? (isDark ? "라이트 모드로 전환" : "다크 모드로 전환") : "테마 전환"}
			className={className}
			{...props}
		>
			<Sun aria-hidden className="h-5 w-5 dark:hidden" />
			<Moon aria-hidden className="hidden h-5 w-5 dark:block" />
		</Button>
	);
}
