"use client";

import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { Children, isValidElement, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { ClassNameValue } from "tailwind-merge";
import { cn } from "@/utils/cn";

interface MermaidProps {
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

export const Mermaid = ({ children, className }: MermaidProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<Error>();
	const { resolvedTheme } = useTheme();
	const chart = useMemo(() => Children.toArray(children).map(extractText).join("\n"), [children]);

	useEffect(() => {
		if (!ref.current || !chart.trim()) return;

		let disposed = false;
		const isDark = resolvedTheme ? resolvedTheme === "dark" : isDarkFromDom(ref.current);

		try {
			mermaid.initialize({
				startOnLoad: false,
				theme: isDark ? "dark" : "default",
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
