"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import { type AiFeature, type AiRunContext, type AiRunResult, SHARED_SLOT_TARGETS } from "@/cms/ai/definition";
import { SlotRegistryProvider, type SlotSource } from "@/cms/slots/slots";
import { cmsFetch } from "../admin-api";

export const AI_FEATURES_KEY = ["cms", "ai", "features"] as const;

export interface AiFeaturesResponse {
	/** 연결이 준비되어 지금 쓸 수 있는 기능 id. */
	usable: string[];
	items: AiFeature[];
}

export function useAiFeatures(enabled = true) {
	return useQuery({
		queryKey: AI_FEATURES_KEY,
		queryFn: ({ signal }) =>
			cmsFetch<AiFeaturesResponse>("/api/cms/v1/ai/features", {
				signal,
				fallback: "AI 기능 목록을 불러올 수 없습니다.",
			}),
		enabled,
		staleTime: 60_000,
	});
}

export async function runAiFeature(
	body: { featureId: string; draft?: unknown },
	context: AiRunContext,
	signal?: AbortSignal,
): Promise<AiRunResult> {
	const response = await cmsFetch<{ result: AiRunResult }>("/api/cms/v1/ai/run", {
		method: "POST",
		json: { ...body, context },
		signal,
		fallback: "AI 기능을 실행하지 못했습니다.",
	});
	return response.result;
}

/**
 * AI 기능을 화면 자리에 연결한다. AI 화면에서 켠 기능이 대상(자리·필드·컬렉션)이 맞는 자리에 버튼으로 붙는다.
 * 그 기능이 쓸 연결이 준비되지 않았으면 붙이지 않는다.
 */
export function AiSlotProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const { data } = useAiFeatures(!pathname?.startsWith("/admin/login"));

	const sources = useMemo<SlotSource[]>(() => {
		const usable = new Set(data?.usable ?? []);
		const features = data ? data.items.filter((feature) => feature.enabled && usable.has(feature.id)) : [];
		const source: SlotSource = (place) => {
			// 같은 일을 하는 자리는 그 기능을 같이 쓴다(미디어 기본 대체 텍스트 → 대체 텍스트 추천).
			const { slot, target } = SHARED_SLOT_TARGETS[`${place.slot}:${place.target}`] ?? place;
			const { collection } = place;
			return features
				.filter(
					(feature) =>
						feature.slot === slot &&
						feature.target === target &&
						(slot !== "field" ||
							feature.collections.length === 0 ||
							(collection !== undefined && feature.collections.includes(collection))),
				)
				.map((feature) => ({
					id: feature.id,
					label: feature.name,
					apply: feature.apply,
					askInstruction: feature.askInstruction,
					run: (context, signal) => runAiFeature({ featureId: feature.id }, context, signal),
				}));
		};
		return [source];
	}, [data]);

	return <SlotRegistryProvider sources={sources}>{children}</SlotRegistryProvider>;
}
