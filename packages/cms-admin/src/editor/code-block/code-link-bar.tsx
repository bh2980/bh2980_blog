"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Code2 } from "lucide-react";
import { Button } from "../../ui/button";
import { codeEffectsKey } from "./effects-plugin";
import { cancelLink, commitLink, linkLines, linkTextRange } from "./link-commands";

const lineLabel = (lines: { start: number; end: number }) =>
	lines.end - lines.start === 1 ? `${lines.start + 1}번째 줄` : `${lines.start + 1}–${lines.end}번째 줄`;

/**
 * 본문–코드 잇기 중에 서식 도구 아래에 뜨는 안내 줄. 먼저 고른 쪽을 보여 주고, 다른 쪽을 고르면 "연결"을 켠다.
 * Esc나 "취소"로 그만둔다.
 */
export function CodeLinkBar({ editor }: { editor: Editor }) {
	const status = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const state = current ? codeEffectsKey.getState(current.state) : undefined;
			if (!current || !state?.linking) return null;
			const text = linkTextRange(current.view);
			const lines = linkLines(current.view);
			return {
				kind: state.linking.kind,
				text: text ? current.state.doc.textBetween(text.from, text.to, " ") : null,
				lines: lines ? { start: lines.start, end: lines.end } : null,
			};
		},
	});
	if (!status) return null;

	const ready = !!status.text && !!status.lines;
	const quoted = status.text ? `“${status.text.length > 24 ? `${status.text.slice(0, 24)}…` : status.text}”` : "";

	return (
		// biome-ignore lint/a11y/useSemanticElements: 편집기 위 안내 줄(상태 알림)이다
		<div
			role="status"
			aria-label="코드 연결"
			className="flex w-full flex-wrap items-center justify-center gap-2 border-t bg-primary/5 px-4 py-1.5 text-xs"
		>
			<Code2 aria-hidden className="size-4 shrink-0 text-primary" />
			<span className="min-w-0">
				{status.kind === "text" ? (
					<>
						<b>{quoted}</b>에 연결할 코드 줄을 고르세요
						{status.lines && <b className="ml-1 text-primary">· {lineLabel(status.lines)}</b>}
					</>
				) : (
					<>
						<b>코드 {status.lines ? lineLabel(status.lines) : ""}</b>에 연결할 본문 글자를 고르세요
						{status.text && <b className="ml-1 text-primary">· {quoted}</b>}
					</>
				)}
			</span>
			<div className="flex gap-1">
				<Button
					type="button"
					size="xs"
					disabled={!ready}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => commitLink(editor.view)}
				>
					연결
				</Button>
				<Button
					type="button"
					variant="outline"
					size="xs"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => cancelLink(editor.view)}
				>
					취소
				</Button>
			</div>
		</div>
	);
}
