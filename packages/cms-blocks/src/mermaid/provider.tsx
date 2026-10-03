"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import { Workflow } from "lucide-react";
import type { ReactNode } from "react";

const components: CmsAdminComponents = { icons: { workflow: Workflow } };

/** Mermaid 다이어그램 블록의 메뉴 아이콘을 관리자 화면에 넣는다. 편집기 미리보기는 사이트가 `fencePreviews.mermaid`로 준다. */
export function MermaidProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
