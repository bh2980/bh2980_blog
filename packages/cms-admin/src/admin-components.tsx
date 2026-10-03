"use client";

import type { Editor, NodeViewProps } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
	type ComponentType,
	createContext,
	Fragment,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
} from "react";
import type { CustomBlockEditorProps } from "./editor/blocks/added/view";
import type { BlockAction } from "./editor/tiptap-editor";
import type { FieldInputProps } from "./screens/entries/field-inputs";

/**
 * 편집 화면 확장(플러그인 등)이 받는 지금 상황. 매 렌더 부르는 훅이므로 안에서 React 훅을 써도 된다.
 * 확장 목록은 관리자 화면이 떠 있는 동안 바뀌지 않아야 한다(훅 순서).
 */
export interface EditorExtensionContext {
	/** 번역본을 편집 중이면 원문·번역 언어. 원문이면 `null`. */
	readonly translateLocales: { readonly sourceLocale: string; readonly targetLocale: string } | null;
	/** 누를 때 읽는 편집 중인 글(제목·컬렉션·언어·ID). */
	readonly getEntry?: () => {
		readonly title: string;
		readonly collection: string;
		readonly locale?: string;
		readonly entryId?: string;
	};
}

/** 글자를 고르면 뜨는 인라인 메뉴에 더하는 동작(예: 문체 다듬기). */
export interface EditorSelectionAction {
	readonly id: string;
	readonly label: string;
	readonly icon: ReactNode;
	readonly run: (editor: Editor) => void;
}

/** 슬래시(`/`) 메뉴에 더하는 삽입 동작(예: 초안 쓰기). `range`는 입력한 `/검색어` 자리다. */
export interface EditorInsertAction {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly keywords: readonly string[];
	/** 메뉴 아이콘(lucide 이름이나 컴포넌트). 없으면 퍼즐 아이콘이다. */
	readonly icon?: string | LucideIcon;
	readonly run: (editor: Editor, range: { from: number; to: number }) => void;
}

/**
 * 편집 화면 확장이 더하는 것. 툴바 끝의 요소, 블록 손잡이 옆 동작, 선택 영역 메뉴·슬래시 메뉴의 동작,
 * 편집기가 생기고 사라질 때 받을 함수.
 */
export interface EditorExtensionResult {
	readonly toolbar?: ReactNode;
	/**
	 * 툴바 밖에 한 번만 그리는 요소(대화 상자 등). 툴바 요소는 폭에 따라 다시 그려질 수 있어,
	 * 열려 있는 동안 상태를 지켜야 하는 것은 여기에 둔다.
	 */
	readonly overlay?: ReactNode;
	readonly blockActions?: readonly BlockAction[];
	readonly selectionActions?: readonly EditorSelectionAction[];
	readonly insertActions?: readonly EditorInsertAction[];
	readonly onEditor?: (editor: Editor | null) => void;
}

export type EditorExtension = (context: EditorExtensionContext) => EditorExtensionResult;

/**
 * 사이트·플러그인이 관리자 화면에 넣는 컴포넌트. 관리자 레이아웃 안에서 `CmsAdminComponentsProvider`로 준다.
 * 서버 레이아웃은 함수를 브라우저로 넘길 수 없으므로, 클라이언트 컴포넌트가 이 공급자를 그린다.
 * 공급자를 겹치면 바깥 값에 안쪽 값을 더한다(같은 이름은 안쪽이 이긴다).
 */
export interface CmsAdminComponents {
	/**
	 * 코드 펜스 블록(예: `mermaid`·`chart`)의 편집기 미리보기. 키는 펜스 언어이고, 값은 원문(`source`)을 받아 그리는
	 * 컴포넌트를 불러오는 함수다(무거운 렌더러를 미리보기를 열 때만 불러온다). 없으면 원문을 그대로 보인다.
	 */
	readonly fencePreviews?: Readonly<
		Record<string, () => Promise<ComponentType<{ readonly source: string; readonly className?: string }>>>
	>;
	/**
	 * 필드 입력. 컬렉션 정의의 필드 `input`이 이 이름을 가리키면 기본 입력 대신 그린다
	 * (예: `fields.text({ input: "color" })` + `fieldInputs: { color: ColorInput }`).
	 */
	readonly fieldInputs?: Readonly<Record<string, ComponentType<FieldInputProps>>>;
	/**
	 * 더한 블록(블록 확장·사이트 설정의 `blocks`, `editor.view: "node"`)의 속성·본문 편집 컴포넌트. 키는 블록 이름이다.
	 * 기본 틀 안에 그린다. 없으면 블록 이름과 속성 입력, 본문을 담은 기본 상자로 편집한다.
	 */
	readonly blockEditors?: Readonly<Record<string, ComponentType<CustomBlockEditorProps>>>;
	/**
	 * 더한 블록의 편집 화면 전체(Tiptap NodeView). 키는 블록 이름이다. `blockEditors`보다 먼저 쓴다.
	 * 틀(`NodeViewWrapper`)과 본문 자리(`NodeViewContent`)를 직접 그린다(예: 콜아웃·탭).
	 */
	readonly blockViews?: Readonly<Record<string, ComponentType<NodeViewProps>>>;
	/** 편집 화면 확장(툴바·블록 동작). */
	readonly editorExtensions?: readonly EditorExtension[];
}

const CmsAdminComponentsContext = createContext<CmsAdminComponents>({});

export function CmsAdminComponentsProvider({
	components,
	children,
}: {
	components: CmsAdminComponents;
	children: ReactNode;
}) {
	const parent = useContext(CmsAdminComponentsContext);
	const value = useMemo<CmsAdminComponents>(
		() => ({
			fencePreviews: { ...parent.fencePreviews, ...components.fencePreviews },
			fieldInputs: { ...parent.fieldInputs, ...components.fieldInputs },
			blockEditors: { ...parent.blockEditors, ...components.blockEditors },
			blockViews: { ...parent.blockViews, ...components.blockViews },
			editorExtensions: [...(parent.editorExtensions ?? []), ...(components.editorExtensions ?? [])],
		}),
		[parent, components],
	);
	return <CmsAdminComponentsContext.Provider value={value}>{children}</CmsAdminComponentsContext.Provider>;
}

export const useCmsAdminComponents = () => useContext(CmsAdminComponentsContext);

/** 등록된 편집 화면 확장을 모두 불러 하나로 합친다. */
export function useEditorExtensions(context: EditorExtensionContext): Required<EditorExtensionResult> {
	const { editorExtensions = [] } = useCmsAdminComponents();
	// 확장 목록은 관리자 화면이 떠 있는 동안 같다. 매 렌더 같은 순서로 같은 수의 훅을 부른다.
	const results = editorExtensions.map((extension) => extension(context));
	const editorCallbacks = results.flatMap((result) => (result.onEditor ? [result.onEditor] : []));
	const callbacksRef = useRef(editorCallbacks);
	callbacksRef.current = editorCallbacks;
	const onEditor = useCallback((editor: Editor | null) => {
		for (const callback of callbacksRef.current) callback(editor);
	}, []);
	return {
		// biome-ignore lint/suspicious/noArrayIndexKey: 확장 목록과 순서는 바뀌지 않는다
		toolbar: results.map((result, index) => <Fragment key={index}>{result.toolbar}</Fragment>),
		// biome-ignore lint/suspicious/noArrayIndexKey: 확장 목록과 순서는 바뀌지 않는다
		overlay: results.map((result, index) => <Fragment key={index}>{result.overlay}</Fragment>),
		blockActions: results.flatMap((result) => result.blockActions ?? []),
		selectionActions: results.flatMap((result) => result.selectionActions ?? []),
		insertActions: results.flatMap((result) => result.insertActions ?? []),
		onEditor,
	};
}
