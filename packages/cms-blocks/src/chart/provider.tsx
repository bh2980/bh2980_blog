"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import { ChartColumn } from "lucide-react";
import type { ReactNode } from "react";

const components: CmsAdminComponents = { icons: { "chart-column": ChartColumn } };

/** 차트 블록의 메뉴 아이콘을 관리자 화면에 넣는다. 편집기 미리보기는 사이트가 `fencePreviews.chart`로 준다. */
export function ChartProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
