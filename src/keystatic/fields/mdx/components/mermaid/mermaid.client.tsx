"use client";

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import type { ClassNameValue } from "tailwind-merge";
import { cn } from "@/utils/cn";

interface MermaidProps {
	chart: string;
	className?: ClassNameValue;
}

export const Mermaid = ({ chart, className }: MermaidProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<Error>();

	useEffect(() => {
		if (!ref.current) return;

		try {
			mermaid.initialize({ startOnLoad: false });

			// 고유 ID 생성
			const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

			mermaid
				.render(id, chart)
				.then(({ svg }) => {
					if (ref.current) {
						ref.current.innerHTML = svg;
						setError(undefined);
					}
				})
				.catch((error) => setError(error));
		} catch {
			setError(new Error("Mermaid render error"));
		}
	}, [chart]);

	return (
		<div className={cn("flex justify-center p-4", className)} data-error={!!error}>
			<div ref={ref} />
			{error && <span className="text-sm">ERROR : {error.message}</span>}
		</div>
	);
};
