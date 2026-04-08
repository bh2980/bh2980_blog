"use client";

import katex from "katex";
import { useEffect, useRef, useState } from "react";
import type { ClassNameValue } from "tailwind-merge";
import { cn } from "@/utils/cn";

export const MathPreview = ({ formula, className }: { formula: string; className?: ClassNameValue }) => {
	const source = formula.trim();
	const previewRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string>();

	useEffect(() => {
		if (!previewRef.current) {
			return;
		}

		if (!source) {
			previewRef.current.textContent = "";
			setError(undefined);
			return;
		}

		try {
			katex.render(source, previewRef.current, {
				displayMode: true,
				output: "htmlAndMathml",
				throwOnError: true,
			});
			setError(undefined);
			return;
		} catch (nextError) {
			setError(nextError instanceof Error ? nextError.message : "수식 렌더링 중 오류가 발생했습니다.");
		}

		katex.render(source, previewRef.current, {
			displayMode: true,
			output: "htmlAndMathml",
			throwOnError: false,
		});
	}, [source]);

	return (
		<div className={cn("overflow-x-auto py-2", className)}>
			{source ? (
				<div ref={previewRef} className="min-w-fit" />
			) : (
				<p className="text-muted-foreground text-sm">수식을 입력하면 여기에 미리보기가 표시됩니다.</p>
			)}
			{error ? <p className="mt-3 text-destructive text-sm">수식 오류: {error}</p> : null}
		</div>
	);
};
