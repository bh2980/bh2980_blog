"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import type { ReactNode } from "react";
import { AiSlotProvider } from "./ai-slot-provider";
import { useAiTranslateExtension } from "./ai-translate";

const components: CmsAdminComponents = { editorExtensions: [useAiTranslateExtension] };

/** AI 플러그인이 관리자 화면 전체에 더하는 것: 자리(필드 옆 등)의 AI 버튼과 번역본 편집기의 AI 번역. */
export function AiAdminProvider({ children }: { children: ReactNode }) {
	return (
		<AiSlotProvider>
			<CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>
		</AiSlotProvider>
	);
}
