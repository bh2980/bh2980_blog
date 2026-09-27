"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "@/libs/i18n/use-locale";
import { cn } from "@/utils/cn";

export function CopyButton({ text, className }: { text: string; className?: string }) {
	const [copied, setCopied] = useState(false);
	const { t } = useTranslate();

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
				"absolute top-2 right-2 rounded border border-current/30 bg-current/10 p-2 hover:bg-current/20 dark:text-slate-200 dark:hover:bg-slate-400/20",
				className,
			)}
			aria-label={t("mdx.copy")}
			onClick={handleCopy}
			type="button"
		>
			{copied ? <Check size={14} /> : <Copy size={14} />}
		</button>
	);
}
