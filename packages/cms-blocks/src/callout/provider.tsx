"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import type { ReactNode } from "react";
import { CalloutNodeView } from "./view";

const components: CmsAdminComponents = { blockViews: { callout: CalloutNodeView } };

/** 콜아웃 블록의 편집 화면을 관리자 화면에 넣는다. */
export function CalloutProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
