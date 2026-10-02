"use client";

import { type ComponentType, createContext, type ReactNode, useContext } from "react";

/**
 * 사이트가 관리자 화면에 넣는 컴포넌트. 관리자 레이아웃 안에서 `CmsAdminComponentsProvider`로 준다.
 * 서버 레이아웃은 함수를 브라우저로 넘길 수 없으므로, 사이트의 클라이언트 컴포넌트가 이 공급자를 그린다.
 */
export interface CmsAdminComponents {
	/**
	 * 코드 펜스 블록(예: `mermaid`·`chart`)의 편집기 미리보기. 키는 펜스 언어이고, 값은 원문(`source`)을 받아 그리는
	 * 컴포넌트를 불러오는 함수다(무거운 렌더러를 미리보기를 열 때만 불러온다). 없으면 원문을 그대로 보인다.
	 */
	readonly fencePreviews?: Readonly<
		Record<string, () => Promise<ComponentType<{ readonly source: string; readonly className?: string }>>>
	>;
}

const CmsAdminComponentsContext = createContext<CmsAdminComponents>({});

export function CmsAdminComponentsProvider({
	components,
	children,
}: {
	components: CmsAdminComponents;
	children: ReactNode;
}) {
	return <CmsAdminComponentsContext.Provider value={components}>{children}</CmsAdminComponentsContext.Provider>;
}

export const useCmsAdminComponents = () => useContext(CmsAdminComponentsContext);
