"use client";

import { Chart as SharedChart } from "@/components/mdx/chart";

export const Chart = ({ source }: { source: string }) => {
	return <SharedChart source={source} />;
};
