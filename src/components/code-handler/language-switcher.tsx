"use client";

import { type HighlightedCode, Pre } from "codehike/code";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Code({ highlighted }: { highlighted: HighlightedCode[] }) {
	const [selectedLang, setSelectedLang] = useState(highlighted[0].lang);
	const selectedCode = highlighted.find((code) => code.lang === selectedLang)!;

	return (
		<div className="relative">
			<Pre code={selectedCode} className="m-0 bg-zinc-950/80 px-4 pt-6" />
			<div className="absolute top-2 right-2">
				<Select value={selectedLang} onValueChange={setSelectedLang}>
					<SelectTrigger className="!bg-transparent !p-2 !ring-zinc-300/50 h-6 gap-2 border-none text-slate-300">
						<SelectValue />
					</SelectTrigger>
					<SelectContent position="item-aligned">
						{highlighted.map(({ lang }) => (
							<SelectItem key={lang} value={lang}>
								{lang}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
