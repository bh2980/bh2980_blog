"use client";

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";

interface MermaidProps {
	chart: string;
}

export const Mermaid = ({ chart }: MermaidProps) => {
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
					if (ref.current) ref.current.innerHTML = svg;
				})
				.catch((error) => setError(error));
		} catch {
			setError(new Error("Mermaid render error"));
		}
	}, [chart]);

	return <div ref={ref}>{error && <span>{error.message}</span>}</div>;
};
