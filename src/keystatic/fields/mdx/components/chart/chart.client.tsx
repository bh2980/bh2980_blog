"use client";

import { Chart as SharedChart } from "@/components/mdx/chart";

export const Chart = ({ source, className }: { source: string; className?: string }) => {
	return <SharedChart source={source} className={className} />;
};
