"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
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
			className="hover:bg-gray-400/20 p-2 rounded absolute top-1 right-1 text-zinc-200"
			aria-label="클립보드에 복사하기"
			onClick={handleCopy}
			type="button"
		>
			{copied ? <Check size={16} /> : <Copy size={16} />}
		</button>
	);
}
