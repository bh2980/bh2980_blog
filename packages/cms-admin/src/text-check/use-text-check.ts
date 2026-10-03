"use client";

import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type DocSegment, docRangeToSegment, extractSegments } from "./extract";
import { createTextCheckPlugin, type TextCheckMeta, textCheckIssues, textCheckPluginKey } from "./plugin";
import { checkSegments, type DocTextIssue, ignoreKey, placeIssues, TextCheckCache } from "./run";
import { supportsLocale, type TextChecker } from "./types";

/** 저절로 검사(`auto: true`)는 입력을 이만큼 멈추면 돈다. */
export const AUTO_CHECK_DELAY = 1500;

export interface TextCheckController {
	readonly editor: Editor;
	/** 이 글의 언어를 검사하는 검사기. */
	readonly checkers: readonly TextChecker[];
	readonly running: boolean;
	readonly issues: readonly DocTextIssue[];
	/** 열린 결과 창. `focus`면 창 안으로 초점을 옮긴다(목록에서 고른 때). */
	readonly open: { readonly key: string; readonly focus: boolean } | null;
	readonly run: () => Promise<void>;
	readonly close: () => void;
	readonly jump: (issue: DocTextIssue) => void;
	readonly apply: (issue: DocTextIssue, suggestion: string) => void;
	readonly ignore: (issue: DocTextIssue) => void;
}

const NO_ISSUES: readonly DocTextIssue[] = [];

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

/**
 * 편집기의 맞춤법·문장 검사. 그 글의 언어를 검사하는 검사기가 없으면 `null`이고 아무것도 하지 않는다.
 *
 * - 버튼(`run`)으로 검사한다. 고른 글자가 있으면 그 범위에 걸친 문단만, 없으면 문서 전체를 검사한다.
 * - `auto: true`인 검사기만 입력을 멈추면 바뀐 문단을 저절로 검사한다.
 * - 같은 글자의 문단은 다시 보내지 않는다(검사기·언어·글자별 캐시). 다시 검사하거나 닫으면 진행 중인 요청을 끊는다.
 */
export function useTextCheck(
	editor: Editor | null,
	{ checkers: registered, locale }: { checkers: readonly TextChecker[]; locale: string },
): TextCheckController | null {
	const checkers = useMemo(() => registered.filter((checker) => supportsLocale(checker, locale)), [registered, locale]);
	const active = !!editor && checkers.length > 0;
	const [cache] = useState(() => new TextCheckCache());
	const [ignored] = useState(() => new Set<string>());
	const manualRef = useRef<AbortController | null>(null);
	const autoRef = useRef<AbortController | null>(null);
	const [running, setRunning] = useState(false);
	const [open, setOpen] = useState<TextCheckController["open"]>(null);

	const issues = useEditorState({
		editor,
		selector: ({ editor: current }) => (current && active ? textCheckIssues(current.state) : NO_ISSUES),
		equalityFn: (a, b) => a === b,
	});

	useEffect(() => {
		if (!editor || !active) return;
		const plugin = createTextCheckPlugin({ onIssueClick: (issue) => setOpen({ key: issue.key, focus: false }) });
		editor.registerPlugin(plugin);
		return () => {
			manualRef.current?.abort();
			autoRef.current?.abort();
			setOpen(null);
			if (!editor.isDestroyed) editor.unregisterPlugin(textCheckPluginKey);
		};
	}, [editor, active]);

	/** 검사한 문단(이름)의 결과를 지금 문서에 다시 놓는다. 검사 중 문단 글자가 바뀌었으면(이름이 달라져) 건너뛴다. */
	const place = useCallback(
		(
			current: Editor,
			done: readonly TextChecker[],
			ids: ReadonlySet<string>,
			scopes?: ReadonlyMap<string, { start: number; end: number }>,
		) => {
			const segments = extractSegments(current.state.doc, { locale }).filter((segment) => ids.has(segment.id));
			const placed = placeIssues({ checkers: done, segments, locale, cache, ignored, scopes });
			const ranges = segments.map((segment) => {
				const scope = scopes?.get(segment.id);
				const from = scope ? segment.starts[scope.start] : undefined;
				const to = scope ? segment.ends[scope.end - 1] : undefined;
				return from !== undefined && to !== undefined ? { from, to } : { from: segment.from, to: segment.to };
			});
			const meta: TextCheckMeta = {
				type: "replace",
				checkerIds: done.map((checker) => checker.id),
				ranges,
				issues: placed,
			};
			current.view.dispatch(current.state.tr.setMeta(textCheckPluginKey, meta).setMeta("addToHistory", false));
			return placed.length;
		},
		[cache, ignored, locale],
	);

	/** 검사기마다 따로 돌린다. 끝난 검사기와 실패한 검사기(끊긴 것 제외)를 돌려준다. */
	const checkAll = useCallback(
		async (list: readonly TextChecker[], segments: readonly DocSegment[], signal: AbortSignal) => {
			const results = await Promise.allSettled(
				list.map((checker) => checkSegments({ checker, segments, locale, cache, signal })),
			);
			const done: TextChecker[] = [];
			const failed: { checker: TextChecker; error: unknown }[] = [];
			results.forEach((result, index) => {
				const checker = list[index];
				if (!checker) return;
				if (result.status === "fulfilled") done.push(checker);
				else if (!isAbort(result.reason)) failed.push({ checker, error: result.reason });
			});
			return { done, failed };
		},
		[cache, locale],
	);

	const run = useCallback(async () => {
		if (!editor || !active) return;
		manualRef.current?.abort();
		autoRef.current?.abort();
		const controller = new AbortController();
		manualRef.current = controller;
		const { selection, doc } = editor.state;
		const range = selection.empty ? null : { from: selection.from, to: selection.to };
		const segments = extractSegments(doc, { locale, range });
		if (segments.length === 0) {
			manualRef.current = null;
			toast("검사할 글이 없습니다.");
			return;
		}
		const scopes = range
			? new Map(
					segments.flatMap((segment) => {
						const scope = docRangeToSegment(segment, range.from, range.to);
						return scope ? [[segment.id, scope] as const] : [];
					}),
				)
			: undefined;
		setOpen(null);
		setRunning(true);
		try {
			const { done, failed } = await checkAll(checkers, segments, controller.signal);
			if (controller.signal.aborted || editor.isDestroyed) return;
			const count = done.length > 0 ? place(editor, done, new Set(segments.map((segment) => segment.id)), scopes) : 0;
			const [first] = failed;
			if (first) {
				const names = failed.map(({ checker }) => checker.label).join(", ");
				toast.error(failed.length === checkers.length ? "검사하지 못했습니다." : `${names} 검사를 하지 못했습니다.`, {
					description: errorMessage(first.error),
				});
			} else if (count === 0) toast.success("고칠 곳이 없습니다.");
		} finally {
			if (manualRef.current === controller) {
				manualRef.current = null;
				setRunning(false);
			}
		}
	}, [editor, active, locale, checkers, checkAll, place]);

	// 저절로 검사: `auto: true`인 검사기만, 열었을 때와 다른 문단(바뀐 문단)만.
	useEffect(() => {
		if (!editor || !active) return;
		const autoCheckers = checkers.filter((checker) => checker.auto);
		if (autoCheckers.length === 0) return;
		const known = new Set<string>();
		const remember = () => {
			for (const segment of extractSegments(editor.state.doc, { locale })) known.add(segment.text);
		};
		remember();
		let timer: ReturnType<typeof setTimeout> | undefined;
		let failedOnce = false;
		const fire = async () => {
			if (editor.isDestroyed) return;
			// 조합 중이거나 버튼 검사가 도는 동안은 미룬다.
			if (editor.view.composing || manualRef.current) {
				timer = setTimeout(fire, AUTO_CHECK_DELAY);
				return;
			}
			const segments = extractSegments(editor.state.doc, { locale }).filter((segment) => !known.has(segment.text));
			if (segments.length === 0) return;
			autoRef.current?.abort();
			const controller = new AbortController();
			autoRef.current = controller;
			const { done, failed } = await checkAll(autoCheckers, segments, controller.signal);
			if (controller.signal.aborted || editor.isDestroyed) return;
			if (autoRef.current === controller) autoRef.current = null;
			if (done.length > 0) place(editor, done, new Set(segments.map((segment) => segment.id)));
			// 다 끝난 문단은 다음 저절로 검사에서 다시 놓지 않는다(결과는 위치를 따라간다).
			if (failed.length === 0) for (const segment of segments) known.add(segment.text);
			// 저절로 검사의 실패는 한 번만 알린다(입력할 때마다 알림이 쌓이지 않게).
			const [first] = failed;
			if (first && !failedOnce) {
				failedOnce = true;
				toast.error(`${first.checker.label} 검사를 하지 못했습니다.`, { description: errorMessage(first.error) });
			}
		};
		const onTransaction = ({ transaction }: { transaction: Transaction }) => {
			if (!transaction.docChanged) return;
			// 바깥에서 본문을 통째로 채운 것(글 불러오기 등)은 입력이 아니다. 그 문단은 바뀐 문단으로 보지 않는다.
			if (transaction.getMeta("preventUpdate")) {
				remember();
				return;
			}
			clearTimeout(timer);
			timer = setTimeout(fire, AUTO_CHECK_DELAY);
		};
		editor.on("transaction", onTransaction);
		return () => {
			editor.off("transaction", onTransaction);
			clearTimeout(timer);
			autoRef.current?.abort();
		};
	}, [editor, active, checkers, locale, checkAll, place]);

	const close = useCallback(() => setOpen(null), []);

	const jump = useCallback(
		(issue: DocTextIssue) => {
			if (!editor) return;
			editor.chain().setTextSelection({ from: issue.from, to: issue.to }).scrollIntoView().run();
			// 목록 메뉴가 닫히며 초점을 돌려준 뒤에 연다.
			setTimeout(() => setOpen({ key: issue.key, focus: true }), 0);
		},
		[editor],
	);

	const apply = useCallback(
		(issue: DocTextIssue, suggestion: string) => {
			if (!editor || !editor.isEditable) return;
			const current = textCheckIssues(editor.state).find((item) => item.key === issue.key);
			if (!current) return;
			editor.view.dispatch(editor.state.tr.insertText(suggestion, current.from, current.to));
			setOpen(null);
			editor.commands.focus();
		},
		[editor],
	);

	const ignore = useCallback(
		(issue: DocTextIssue) => {
			if (!editor) return;
			const key = ignoreKey(issue);
			ignored.add(key);
			const keys = textCheckIssues(editor.state)
				.filter((item) => ignoreKey(item) === key)
				.map((item) => item.key);
			const meta: TextCheckMeta = { type: "remove", keys };
			editor.view.dispatch(editor.state.tr.setMeta(textCheckPluginKey, meta).setMeta("addToHistory", false));
			setOpen(null);
			editor.commands.focus();
		},
		[editor, ignored],
	);

	return useMemo(
		() =>
			editor && active
				? { editor, checkers, running, issues: issues ?? NO_ISSUES, open, run, close, jump, apply, ignore }
				: null,
		[editor, active, checkers, running, issues, open, run, close, jump, apply, ignore],
	);
}
