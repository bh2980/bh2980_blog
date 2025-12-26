"use client";

import mermaid from "mermaid";
import { useEffect, useRef } from "react";

interface MermaidProps {
	chart: string;
}

export default function Mermaid({ chart }: MermaidProps) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!ref.current) return;

		mermaid.initialize({ startOnLoad: false });

		// 고유 ID 생성
		const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

		mermaid.render(id, chart).then(({ svg }) => {
			if (ref.current) ref.current.innerHTML = svg;
		});
	}, [chart]);

	return <div ref={ref} />;
}
