"use client";

import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { Children, isValidElement, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { ClassNameValue } from "tailwind-merge";
import { cn } from "@/utils/cn";

interface MermaidProps {
	/** 코드 펜스 원문(본체 `remarkFenceBlocksToMdx`). 없으면 자식 글자를 쓴다. */
	source?: string;
	children?: ReactNode;
	className?: ClassNameValue;
}

const extractText = (node: ReactNode): string => {
	if (node == null || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(extractText).join("");
	if (!isValidElement<{ children?: ReactNode }>(node)) return "";

	return extractText(node.props.children);
};

const isDarkFromDom = (element: HTMLElement | null) => {
	if (typeof document === "undefined") return false;

	if (element?.closest(".kui-scheme--dark")) return true;
	if (element?.closest(".kui-scheme--light")) return false;
	if (document.documentElement.classList.contains("dark")) return true;
	if (document.body.classList.contains("dark")) return true;

	return typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
};

/**
 * 공개 화면의 색 토큰(종이·먹·남색)으로 다이어그램을 칠한다. Mermaid는 CSS 변수를 못 읽어 계산된 값을 넘긴다.
 * 토큰이 없는 곳(블로그 밖)에서는 Mermaid 기본 테마를 쓴다.
 */
/** 두 hex 색을 섞는다(`ratio`만큼 `a`). Mermaid는 color-mix를 못 읽어 직접 계산한다. */
const mixHex = (a: string, b: string, ratio: number) => {
	const channels = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
	const [ca, cb] = [channels(a), channels(b)];
	return `#${ca
		.map((value, index) =>
			Math.round(value * ratio + cb[index] * (1 - ratio))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
};

const themeFromTokens = (element: HTMLElement, isDark: boolean) => {
	const style = getComputedStyle(element);
	const token = (name: string) => style.getPropertyValue(name).trim();
	const [background, foreground, muted, mutedForeground, border, primary] = [
		"--background",
		"--foreground",
		"--muted",
		"--muted-foreground",
		"--border",
		"--primary",
	].map(token);
	if (!background.startsWith("#") || !primary.startsWith("#")) {
		return { theme: isDark ? ("dark" as const) : ("default" as const) };
	}
	const tint = mixHex(primary, background, isDark ? 0.2 : 0.1);

	return {
		theme: "base" as const,
		darkMode: isDark,
		fontFamily: style.fontFamily,
		themeVariables: {
			background,
			// 칸은 남색을 옅게 깐 종이, 테두리는 남색
			primaryColor: tint,
			primaryTextColor: foreground,
			primaryBorderColor: primary,
			secondaryColor: background,
			secondaryTextColor: foreground,
			secondaryBorderColor: border,
			tertiaryColor: background,
			tertiaryTextColor: foreground,
			tertiaryBorderColor: border,
			lineColor: mutedForeground,
			textColor: foreground,
			mainBkg: tint,
			nodeBorder: primary,
			clusterBkg: background,
			clusterBorder: border,
			edgeLabelBackground: background,
			noteBkgColor: background,
			noteTextColor: foreground,
			noteBorderColor: border,
			actorBkg: tint,
			actorBorder: primary,
			actorTextColor: foreground,
			signalColor: foreground,
			signalTextColor: foreground,
			labelBoxBkgColor: muted,
			labelBoxBorderColor: border,
			labelTextColor: foreground,
			activationBkgColor: tint,
			activationBorderColor: primary,
		},
	};
};

export const Mermaid = ({ source, children, className }: MermaidProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<Error>();
	const { resolvedTheme } = useTheme();
	const chart = useMemo(() => source ?? Children.toArray(children).map(extractText).join("\n"), [source, children]);

	useEffect(() => {
		if (!ref.current || !chart.trim()) return;

		let disposed = false;
		const isDark = resolvedTheme ? resolvedTheme === "dark" : isDarkFromDom(ref.current);

		try {
			mermaid.initialize({
				startOnLoad: false,
				...themeFromTokens(ref.current, isDark),
			});

			const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;

			mermaid
				.render(id, chart)
				.then(({ svg }) => {
					if (!ref.current || disposed) return;

					ref.current.innerHTML = svg;
					setError(undefined);
				})
				.catch((nextError) => {
					if (!disposed) setError(nextError);
				});
		} catch {
			setError(new Error("Mermaid render error"));
		}

		return () => {
			disposed = true;
		};
	}, [chart, resolvedTheme]);

	return (
		<div className={cn("flex justify-center overflow-x-auto p-4", className)} data-error={!!error}>
			<div ref={ref} className="flex w-full justify-center [&_svg]:h-auto [&_svg]:max-w-full" />
			{error && <span className="text-sm">ERROR : {error.message}</span>}
		</div>
	);
};
