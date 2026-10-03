"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import type { ReactNode } from "react";
import { ColumnNodeView, ColumnsNodeView } from "./view";

const components: CmsAdminComponents = { blockViews: { columns: ColumnsNodeView, column: ColumnNodeView } };

/** 단 나누기 블록의 편집 화면을 관리자 화면에 넣는다. */
export function ColumnsProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
