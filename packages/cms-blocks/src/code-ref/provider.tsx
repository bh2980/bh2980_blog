"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import {
	addedMarkName,
	allowsMark,
	BubbleButton,
	type EditorBubbleProps,
	type EditorMarkDetailProps,
	type EditorMarkExtension,
	findAnchor,
	startLinkFromText,
	unlinkRef,
} from "@bh2980/cms-admin/editor";
import { cn } from "@bh2980/cms-admin/lib/utils/cn";
import type { Editor } from "@tiptap/core";
import { Code2, Unlink } from "lucide-react";
import type { ReactNode } from "react";
import { codeRefBlock } from "./definition";

/** 편집기 마크 이름(`cmsCodeRef`). */
export const CODE_REF_MARK = addedMarkName(codeRefBlock.name);

/** 문서에 코드 블록이 있는가. 없으면 이을 줄이 없어 `코드 연결`을 숨긴다. */
const hasCodeBlock = (editor: Editor) => {
	let found = false;
	editor.state.doc.descendants((node) => {
		if (node.type.name === "codeBlock") found = true;
		return !found;
	});
	return found;
};

function CodeRefBubbleButton({ editor, inCode }: EditorBubbleProps) {
	if (inCode || !allowsMark(editor.state, CODE_REF_MARK) || !hasCodeBlock(editor)) return null;
	return (
		<BubbleButton
			label="코드 연결"
			onClick={() => {
				const { from, to } = editor.state.selection;
				startLinkFromText(editor.view, from, to);
			}}
		>
			<Code2 aria-hidden className="size-4" />
		</BubbleButton>
	);
}

function CodeRefDetail({ editor, mark, act }: EditorMarkDetailProps) {
	const anchor = findAnchor(editor.state.doc, String(mark.attrs.to ?? ""));
	const where = anchor
		? `${anchor.title ? `${anchor.title} ` : ""}${anchor.end - anchor.start === 1 ? `${anchor.start + 1}줄` : `${anchor.start + 1}–${anchor.end}줄`}`
		: null;
	return (
		<>
			<Code2 aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground" />
			<span className={cn("max-w-56 truncate px-1 text-xs", where ? "text-muted-foreground" : "text-destructive")}>
				{where ? `코드 ${where}` : "연결된 코드 줄이 없습니다"}
			</span>
			<BubbleButton
				label="코드 다시 연결"
				className="text-xs"
				onClick={act(() => startLinkFromText(editor.view, mark.from, mark.to))}
			>
				다시 연결
			</BubbleButton>
			<BubbleButton label="코드 연결 해제" onClick={act(() => unlinkRef(editor.view, mark.from, mark.to))}>
				<Unlink aria-hidden className="size-4" />
			</BubbleButton>
		</>
	);
}

/** 코드 연결 꾸밈의 편집기 등록. 테마 강조색 밑줄로 보인다. */
export const codeRefMarkExtension: EditorMarkExtension = {
	render: () => ({ class: "underline decoration-primary/60 decoration-solid underline-offset-4" }),
	bubble: { group: "link", order: 1, Button: CodeRefBubbleButton },
	detail: CodeRefDetail,
};

const components: CmsAdminComponents = { marks: { [codeRefBlock.name]: codeRefMarkExtension } };

/** 코드 연결 꾸밈의 편집기 표시·버블을 관리자 화면에 넣는다. */
export function CodeRefProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
