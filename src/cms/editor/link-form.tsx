"use client";

import type { ChainedCommands, Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Unlink } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function normalizeLinkHref(value: string): string | null {
	const href = value.trim();
	if (!href || /\s/.test(href)) return null;
	if ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")) return href;
	if (/^mailto:[^@\s]+@[^@\s]+$/i.test(href)) return href;
	if (/^https?:\/\//i.test(href)) {
		try {
			return new URL(href).href;
		} catch {
			return null;
		}
	}
	if (/^[^/:?#\s]+\.[^/:?#\s]{2,}(?:[/?#].*)?$/i.test(href)) return `https://${href}`;
	return null;
}

/** 링크를 넣거나 고칠 범위. 폼을 여는 순간의 선택을 붙잡아 둔다(입력칸으로 초점이 옮겨 가도 유지). */
export interface LinkDraft {
	from: number;
	to: number;
	existing: boolean;
	href: string;
}

export function linkDraftFromSelection(editor: Editor): LinkDraft {
	const { from, to } = editor.state.selection;
	const existing = editor.isActive("link");
	return { from, to, existing, href: existing ? String(editor.getAttributes("link").href ?? "") : "" };
}

/** 효과를 적용한 뒤 커서를 그 끝으로 모은다. 커서가 효과 끝에 있으면 인라인 버블이 적용 결과를 보여 준다. */
export const collapseToEnd = (chain: ChainedCommands) =>
	chain.command(({ tr }) => {
		tr.setSelection(TextSelection.near(tr.doc.resolve(tr.selection.to), -1));
		return true;
	});

interface LinkFormProps {
	editor: Editor;
	draft: LinkDraft;
	onDone: () => void;
}

/** 링크 주소 입력 폼. 상단 서식 도구의 팝오버와 인라인 버블이 함께 쓴다. */
export function LinkForm({ editor, draft, onDone }: LinkFormProps) {
	const id = useId();
	const [href, setHref] = useState(draft.href);
	const [text, setText] = useState(() =>
		draft.from === draft.to ? "" : editor.state.doc.textBetween(draft.from, draft.to),
	);
	const [error, setError] = useState<string | null>(null);
	const needsText = !draft.existing && draft.from === draft.to;

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const normalized = normalizeLinkHref(href);
		if (!normalized) {
			setError("http(s) 주소, 사이트 경로 또는 이메일 주소를 입력하세요.");
			return;
		}
		const command = editor.chain().focus().setTextSelection({ from: draft.from, to: draft.to });
		if (draft.existing) collapseToEnd(command.extendMarkRange("link").setLink({ href: normalized })).run();
		else if (!needsText) collapseToEnd(command.setLink({ href: normalized })).run();
		else
			command
				.insertContent({
					type: "text",
					text: text.trim() || normalized,
					marks: [{ type: "link", attrs: { href: normalized } }],
				})
				.run();
		onDone();
	};

	const remove = () => {
		editor
			.chain()
			.focus()
			.setTextSelection({ from: draft.from, to: draft.to })
			.extendMarkRange("link")
			.unsetLink()
			.setTextSelection({ from: draft.from, to: draft.to })
			.run();
		onDone();
	};

	return (
		<form onSubmit={submit} className="grid gap-3">
			<p className="font-medium">{draft.existing ? "링크 수정" : "링크 삽입"}</p>
			{needsText && (
				<label htmlFor={`${id}-text`} className="grid gap-1.5 text-xs">
					표시 텍스트
					<Input
						id={`${id}-text`}
						value={text}
						onChange={(event) => setText(event.target.value)}
						placeholder="링크 텍스트"
					/>
				</label>
			)}
			<label htmlFor={`${id}-href`} className="grid gap-1.5 text-xs">
				주소
				<Input
					id={`${id}-href`}
					autoFocus
					value={href}
					onChange={(event) => {
						setHref(event.target.value);
						setError(null);
					}}
					placeholder="https://example.com"
				/>
			</label>
			{error && (
				<p role="alert" className="text-destructive text-xs">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2">
				{draft.existing && (
					<Button type="button" variant="outline" size="sm" onClick={remove}>
						<Unlink aria-hidden className="size-4" />
						링크 제거
					</Button>
				)}
				<Button type="submit" size="sm">
					{draft.existing ? "수정" : "삽입"}
				</Button>
			</div>
		</form>
	);
}
