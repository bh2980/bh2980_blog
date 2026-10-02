"use client";

import type { EditorExtension, EditorInsertAction, EditorSelectionAction } from "@bh2980/cms-admin";
import { mdxToTiptap, tiptapToMdx } from "@bh2980/cms-admin/editor";
import { Button } from "@bh2980/cms-admin/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@bh2980/cms-admin/ui/dialog";
import { Input } from "@bh2980/cms-admin/ui/input";
import type { Editor, JSONContent } from "@tiptap/core";
import { PenLine, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AiActionView } from "../actions";
import { streamAiAction, useAiActions } from "./ai-slot-provider";
import { diffWords } from "./word-diff";

/**
 * 본문에 글을 쓰는 AI 기능(M8-2·M8-3). 붙을 곳이 `selection`(선택 영역 메뉴, 예: 문체 다듬기)이면 고른 글을 다듬어
 * 바뀐 곳을 보여 준 뒤 바꾸고, `insert`(슬래시 메뉴·빈 문서, 예: 초안 쓰기)면 커서 자리에 넣는다.
 * 결과는 흘려받아 조금씩 보인다. 적용은 사용자가 누를 때만 한다.
 */

type Job =
	| { mode: "selection"; action: AiActionView; editor: Editor; from: number; to: number; source: string }
	| { mode: "insert"; action: AiActionView; editor: Editor; from: number; to: number };

type RunState =
	| { status: "idle" }
	| { status: "running"; text: string }
	| { status: "done"; text: string }
	| { status: "error"; text: string; message: string };

/** 선택한 부분의 MDX. 부분만 고른 문단도 그 부분만 담는다. */
function selectionMdx(editor: Editor, from: number, to: number): string {
	const slice = editor.state.doc.slice(from, to);
	const nodes = (slice.content.toJSON() ?? []) as JSONContent[];
	// 한 문단 안을 고르면 글자 조각만 온다. 문단으로 감싸야 MDX가 된다.
	const content = slice.content.firstChild?.isInline ? [{ type: "paragraph", content: nodes }] : nodes;
	return tiptapToMdx({ type: "doc", content }).trim();
}

/** 결과 MDX를 편집기 내용으로. 한 문단 안을 고쳤고 결과도 한 문단이면 글자만 넣는다(문단을 쪼개지 않는다). */
function contentFor(editor: Editor, from: number, to: number, mdx: string): JSONContent[] {
	const blocks = mdxToTiptap(mdx).content ?? [];
	const $from = editor.state.doc.resolve(from);
	const $to = editor.state.doc.resolve(to);
	const inline = $from.parent === $to.parent && $from.parent.isTextblock;
	const only = blocks.length === 1 ? blocks[0] : undefined;
	return inline && only?.type === "paragraph" ? (only.content ?? []) : blocks;
}

function WriteDialog({ job, getEntry, onClose }: { job: Job; getEntry: GetEntry; onClose: () => void }) {
	const [request, setRequest] = useState("");
	const [state, setState] = useState<RunState>({ status: "idle" });
	const controllerRef = useRef<AbortController | null>(null);
	const { action, editor } = job;

	const run = async () => {
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;
		setState({ status: "running", text: "" });
		const entry = getEntry?.();
		const input: Record<string, unknown> =
			job.mode === "selection"
				? { selection: job.source, title: entry?.title || undefined }
				: { title: entry?.title || undefined, body: tiptapToMdx(editor.getJSON()).trim() || undefined };
		try {
			const result = await streamAiAction(
				action.key,
				Object.fromEntries(Object.entries(input).filter(([name, value]) => value && action.input[name])),
				{
					env: {
						...(entry?.collection ? { collection: entry.collection } : {}),
						...(entry?.locale ? { locale: entry.locale } : {}),
						...(entry?.entryId ? { entryId: entry.entryId } : {}),
					},
					request,
					signal: controller.signal,
					onText: (text) => setState({ status: "running", text }),
				},
			);
			if (controller.signal.aborted) return;
			setState({ status: "done", text: "text" in result ? result.text : "" });
		} catch (error) {
			if (controller.signal.aborted) return;
			setState((current) => ({
				status: "error",
				text: "text" in current ? current.text : "",
				message: error instanceof Error && error.message ? error.message : "실행하지 못했습니다.",
			}));
		}
	};

	// 고친 글이 정해진 다듬기는 열자마자 실행한다. 초안은 요청을 먼저 받는다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: 열 때 한 번만 실행한다
	useEffect(() => {
		if (job.mode === "selection") void run();
		return () => controllerRef.current?.abort();
	}, []);

	const apply = () => {
		if (state.status !== "done" || !state.text) return;
		const content = contentFor(editor, job.from, job.to, state.text);
		editor.chain().focus().insertContentAt({ from: job.from, to: job.to }, content).run();
		onClose();
	};

	const diff = useMemo(
		() => (job.mode === "selection" && state.status === "done" ? diffWords(job.source, state.text) : null),
		[job, state],
	);
	const running = state.status === "running";

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles aria-hidden className="size-4" />
						{action.label}
					</DialogTitle>
				</DialogHeader>
				{action.askInstruction && (
					<form
						className="flex gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							void run();
						}}
					>
						<Input
							aria-label="추가 요청"
							value={request}
							onChange={(event) => setRequest(event.target.value)}
							placeholder={job.mode === "insert" ? "무엇을 쓸까요?" : "추가 요청"}
							className="h-8 text-xs"
							autoFocus={job.mode === "insert"}
						/>
						<Button type="submit" size="sm" disabled={running}>
							{state.status === "idle" ? "쓰기" : "다시"}
						</Button>
					</form>
				)}
				<output
					aria-live="polite"
					className="block max-h-[50vh] min-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
				>
					{diff
						? diff.map((part, index) =>
								part.type === "same" ? (
									// biome-ignore lint/suspicious/noArrayIndexKey: 바뀐 곳 목록은 결과마다 새로 만든다
									<span key={index}>{part.text}</span>
								) : part.type === "del" ? (
									// biome-ignore lint/suspicious/noArrayIndexKey: 바뀐 곳 목록은 결과마다 새로 만든다
									<del key={index} className="bg-destructive/15 text-destructive line-through">
										{part.text}
									</del>
								) : (
									// biome-ignore lint/suspicious/noArrayIndexKey: 바뀐 곳 목록은 결과마다 새로 만든다
									<ins key={index} className="bg-emerald-500/15 text-emerald-700 no-underline dark:text-emerald-400">
										{part.text}
									</ins>
								),
							)
						: "text" in state && state.text
							? state.text
							: state.status === "idle"
								? "요청을 적고 쓰기를 누르세요."
								: "쓰는 중..."}
				</output>
				{state.status === "error" && (
					<p role="alert" className="text-destructive text-xs">
						{state.message}
					</p>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" size="sm" onClick={onClose}>
						취소
					</Button>
					<Button type="button" size="sm" disabled={state.status !== "done" || !state.text} onClick={apply}>
						{job.mode === "selection" ? "바꾸기" : "넣기"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

type GetEntry = Parameters<EditorExtension>[0]["getEntry"];

/** 편집기가 빈 문서인가. 바뀔 때마다 다시 본다. */
function useIsEmpty(editor: Editor | null) {
	const [empty, setEmpty] = useState(false);
	useEffect(() => {
		if (!editor) return;
		const update = () => setEmpty(editor.isEmpty);
		update();
		editor.on("update", update);
		return () => {
			editor.off("update", update);
		};
	}, [editor]);
	return empty;
}

/** 편집 화면 확장으로 붙인 AI 쓰기(문체 다듬기·초안 쓰기). */
export const useAiWriteExtension: EditorExtension = ({ getEntry }) => {
	const { data } = useAiActions();
	const [editor, setEditor] = useState<Editor | null>(null);
	const [job, setJob] = useState<Job | null>(null);
	const empty = useIsEmpty(editor);

	const usable = useMemo(() => {
		const ready = new Set(data?.usable ?? []);
		const actions = (data?.items ?? []).filter((action) => action.enabled && ready.has(action.key));
		return {
			selection: actions.filter((action) => action.attach.some((attach) => attach.slot === "selection")),
			insert: actions.filter((action) => action.attach.some((attach) => attach.slot === "insert")),
		};
	}, [data]);

	const selectionActions = useMemo<EditorSelectionAction[]>(
		() =>
			usable.selection.map((action) => ({
				id: `ai:${action.key}`,
				label: action.label,
				icon: <Wand2 aria-hidden className="size-4" />,
				run: (current) => {
					const { from, to } = current.state.selection;
					if (from === to) return;
					setJob({ mode: "selection", action, editor: current, from, to, source: selectionMdx(current, from, to) });
				},
			})),
		[usable.selection],
	);

	const insertActions = useMemo<EditorInsertAction[]>(
		() =>
			usable.insert.map((action) => ({
				id: `ai:${action.key}`,
				title: action.label,
				description: "AI로 커서 자리에 쓰기",
				keywords: ["ai", "초안", "draft", action.label],
				run: (current, range) => setJob({ mode: "insert", action, editor: current, from: range.from, to: range.to }),
			})),
		[usable.insert],
	);

	const firstInsert = usable.insert[0];
	return {
		toolbar: (
			<>
				{/* 빈 문서에서는 툴바에서 바로 초안을 쓴다. */}
				{empty && editor && firstInsert && (
					<Button
						type="button"
						variant="ghost"
						size="xs"
						onClick={() => {
							const { from, to } = editor.state.selection;
							setJob({ mode: "insert", action: firstInsert, editor, from, to });
						}}
					>
						<PenLine aria-hidden />
						{firstInsert.label}
					</Button>
				)}
			</>
		),
		overlay: job && <WriteDialog job={job} getEntry={getEntry} onClose={() => setJob(null)} />,
		selectionActions,
		insertActions,
		onEditor: setEditor,
	};
};
