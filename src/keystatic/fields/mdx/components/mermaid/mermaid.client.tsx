"use client";

import { Mermaid as SharedMermaid } from "@/components/mdx/mermaid.client";

interface MermaidProps {
	chart: string;
	className?: string;
}

export const Mermaid = ({ chart, className }: MermaidProps) => {
	return <SharedMermaid className={className}>{chart}</SharedMermaid>;
};
