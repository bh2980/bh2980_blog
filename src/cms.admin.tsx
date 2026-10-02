"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import type { ReactNode } from "react";

/**
 * 이 블로그가 관리자 화면에 넣는 컴포넌트. 편집기의 코드 펜스 미리보기는 공개 화면과 같은 렌더러를 쓴다.
 * 렌더러는 미리보기를 열 때만 불러온다.
 */
const components: CmsAdminComponents = {
	fencePreviews: {
		mermaid: () =>
			import("@/components/mdx/mermaid.client").then(({ Mermaid }) => ({ source }: { source: string }) => (
				<Mermaid>{source}</Mermaid>
			)),
		chart: () => import("@/components/mdx/chart").then(({ Chart }) => Chart),
	},
};

export function BlogAdminComponents({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
