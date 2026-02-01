"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";

export function CopyButton({ text, className }: { text: string; className?: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		if (copied) return;
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch (err) {
			console.error("클립보드 복사에 실패했습니다:", err);
		}
	};

	return (
		<button
			className={cn(
				"absolute top-2 right-2 rounded p-2 hover:bg-current/20 dark:text-slate-200 dark:hover:bg-slate-400/20",
				className,
			)}
			aria-label="클립보드에 복사하기"
			onClick={handleCopy}
			type="button"
		>
			{copied ? <Check size={14} /> : <Copy size={14} />}
		</button>
	);
}
