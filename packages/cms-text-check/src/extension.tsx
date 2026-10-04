"use client";

import { DEFAULT_LOCALE } from "@bh2980/cms/client";
import type { EditorExtension } from "@bh2980/cms-admin";
import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { TextCheckToolbar, TextIssuePopover } from "./text-check-controls";
import type { TextChecker } from "./types";
import { useTextCheck } from "./use-text-check";

/**
 * 맞춤법·문장 검사 확장. 관리자 확장(`editorExtensions`)에 넣으면 검사기마다 도구 모음 버튼이 생기고, 결과는 물결 밑줄·
 * 결과 창·목록으로 보인다. 본체 편집기는 확장이 준 버튼·창을 그리기만 한다.
 *
 * ```tsx
 * <CmsAdminComponentsProvider components={{ editorExtensions: [textCheckExtension({ checkers: [myChecker] })] }}>
 * ```
 *
 * 그 글의 언어를 검사하는 검사기가 없으면 아무것도 그리지 않는다. 검사 확장을 여럿 넣어도 밑줄은 서로 겹치지 않는다.
 */
export function textCheckExtension({ checkers }: { readonly checkers: readonly TextChecker[] }): EditorExtension {
	return function useTextCheckExtension(context) {
		const [editor, setEditor] = useState<Editor | null>(null);
		const locale = context.getEntry?.().locale ?? DEFAULT_LOCALE;
		const controller = useTextCheck(editor, { checkers, locale });
		return {
			onEditor: setEditor,
			toolbar: controller ? <TextCheckToolbar controller={controller} /> : null,
			overlay: controller ? <TextIssuePopover controller={controller} /> : null,
		};
	};
}
