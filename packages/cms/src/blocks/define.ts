/**
 * 본문 블록 정의 규격(v2 B3). 블록 하나의 저장 문법, 설정 속성, 자식 규칙, 편집 방식, 공개 렌더러를 한 곳에서 정한다.
 *
 * 정의는 서버(저장 검증)·에디터·공개 렌더러·`/meta`가 함께 쓰므로 **JSON으로 직렬화할 수 있는 값만** 가진다.
 * 편집 UI(NodeView·설정 폼)와 공개 컴포넌트는 이름으로만 가리키고, 구현은 각 등록부에 둔다:
 *
 * - 공개 렌더러: 사이트의 MDX 컴포넌트 표(`component` 이름)
 * - 에디터 NodeView: 내장 블록은 관리자 패키지의 `editor/block-views.ts`(`editor.nodeView` 이름), 사용자 블록은
 *   사이트가 `CmsAdminComponentsProvider`의 `blockEditors`(블록 이름)로 준다. 없으면 기본 속성 상자다.
 *
 * 사이트는 설정의 `blocks`로 내장 블록 일부를 끄고 사용자 블록(`defineBlock`)을 더한다(`blocks/resolve.ts`).
 */

/** 저장 문법. 지시자(§4.4)는 `:::이름`·`::이름`·`:이름[...]`, 코드 펜스는 ` ```언어 `, 수식은 `$$`다. */
export type BlockSyntax =
	| { readonly kind: "container"; readonly directive: string }
	| { readonly kind: "leaf"; readonly directive: string }
	| { readonly kind: "text"; readonly directive: string }
	| { readonly kind: "fence"; readonly lang: string }
	| { readonly kind: "math" };

export interface BlockAttribute {
	readonly type: "string" | "boolean";
	readonly label: string;
	readonly description?: string;
	/** 비어 있으면 발행을 막는다(§4.4, 초안 저장은 막지 않는다). */
	readonly required?: boolean;
	/** 고를 수 있는 값 → 라벨. 있으면 다른 값은 발행을 막는다. */
	readonly options?: Readonly<Record<string, string>>;
	readonly defaultValue?: string | boolean;
	/** 설정 폼 입력. 없으면 종류에 맞는 기본 입력(한 줄·체크·선택)이다. */
	readonly input?: "textarea";
}

export interface BlockChildren {
	/** 자식으로 올 수 있는 블록 이름. 없으면 일반 본문 블록(문단·목록 등)을 담는다. */
	readonly blocks?: readonly string[];
	readonly min?: number;
	readonly max?: number;
}

/**
 * 에디터 표현.
 *
 * - `opaque`: 원문을 보존하는 읽기 전용 상자(원문 모드에서 편집). 삽입 UI가 없는 블록의 기본값이다.
 * - `node`: 전용 NodeView(`nodeView` 이름)로 편집한다.
 * - `mark`: 글자 꾸밈(인라인 지시자).
 * - `attribute`: 다른 노드의 속성으로 표현한다(예: 문단 정렬).
 */
export interface BlockEditor {
	readonly view: "opaque" | "node" | "mark" | "attribute";
	readonly nodeView?: string;
	/** 슬래시 메뉴에 보인다. */
	readonly insertable?: boolean;
	/** 슬래시 메뉴 검색어. */
	readonly keywords?: readonly string[];
}

export interface BlockDefinition {
	/** 정의 이름(소문자 케밥). 지시자 블록은 저장 문법의 이름과 같다. */
	readonly name: string;
	readonly label: string;
	readonly description?: string;
	readonly syntax: BlockSyntax;
	/** 공개 렌더러 이름. 대문자는 `MDX_COMPONENTS`의 컴포넌트, 소문자는 HTML 요소다. */
	readonly component: string;
	/** 컴포넌트가 아니라 렌더 플러그인이 그리면 그 이름(예: 수식은 `rehype-katex`). */
	readonly renderedBy?: string;
	readonly attributes: Readonly<Record<string, BlockAttribute>>;
	/** 자식 규칙. 없으면 자식을 받지 않거나(leaf·fence) 일반 본문을 담는다(container). */
	readonly children?: BlockChildren;
	/** 이 블록 안에서만 쓸 수 있다(예: `tab`은 `tabs` 안). */
	readonly parent?: string;
	readonly editor: BlockEditor;
}

export const defineBlock = <const B extends BlockDefinition>(definition: B): B => definition;
