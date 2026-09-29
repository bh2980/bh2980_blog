"use client";

import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import { type ReactNode, type Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { type HeaderValue, parseFragment, parseHeader } from "@/cms/core/translation/units";
import { buildEditorExtensions } from "@/cms/editor/extensions";
import { ImageInsertDialog, type ImageInsertion } from "@/cms/editor/image-insert-dialog";
import { InlineBubble } from "@/cms/editor/inline-bubble";
import { mdxToTiptap, tiptapToMdx } from "@/cms/editor/tiptap-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";

const PROSE = "prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed";

/** 번역 결과 조각이 그 줄에 맞는지 본다. 알맞으면 null, 아니면 짧은 오류 문구를 돌려준다. */
export const validateFragment = (mdx: string, type: string): string | null => {
	const nodes = parseFragment(mdx);
	if (nodes.length !== 1) return "블록 하나만";
	return nodes[0]?.type === type ? null : "같은 종류의 블록만";
};

/** 머리 줄 값을 한 줄 글자로 만든다. */
export const headerTexts = (value: HeaderValue | null): string[] => {
	if (!value) return [];
	return "title" in value ? [value.title] : value.labels;
};

const headerLine = (value: string | null) => headerTexts(value === null ? null : parseHeader(value)).join(" · ");

/** 화면 근처에 왔을 때 처음 그린다. 글이 길어도 편집기를 한꺼번에 만들지 않는다. */
function LazyMount({ children, minHeight = 40 }: { children: ReactNode; minHeight?: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const [shown, setShown] = useState(false);
	useEffect(() => {
		if (shown) return;
		const element = ref.current;
		if (!element || typeof IntersectionObserver === "undefined") {
			setShown(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setShown(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "400px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [shown]);
	return (
		<div ref={ref} style={shown ? undefined : { minHeight }}>
			{shown && children}
		</div>
	);
}

function PreviewEditor({ mdx }: { mdx: string }) {
	const [extensions] = useState(() => buildEditorExtensions());
	const content = useMemo(() => mdxToTiptap(mdx), [mdx]);
	const editor = useEditor({
		immediatelyRender: false,
		editable: false,
		extensions,
		content,
		editorProps: { attributes: { class: cn(PROSE, "focus:outline-none") } },
	});
	return <EditorContent editor={editor} />;
}

/** 읽기 전용 MDX 미리보기. 편집기와 같은 모양으로 그린다. */
export function UnitPreview({ mdx }: { mdx: string }) {
	return (
		<LazyMount>
			<PreviewEditor key={mdx} mdx={mdx} />
		</LazyMount>
	);
}

function HeaderText({ value }: { value: string | null }) {
	const text = headerLine(value);
	return text ? <p className="text-sm">{text}</p> : <p className="text-muted-foreground text-sm">-</p>;
}

/** 줄의 원문 조각을 읽기 전용으로 보인다. 머리 줄은 글자로, 블록은 편집기 모양으로 보인다. */
export function UnitValue({ header, value }: { header: boolean; value: string }) {
	return header ? <HeaderText value={value} /> : <UnitPreview mdx={value} />;
}

/**
 * 빈칸에서 번역을 시작할 때의 뼈대: 원문과 같은 종류·구조(제목 단계, 목록 항목 수, 표 칸, 코드 언어)에서
 * 글자와 이미지 설명만 비운다. 빈 문단에서 시작하면 제목·목록을 번역할 때 종류가 달라진다.
 */
export const blankLike = (json: JSONContent): JSONContent => {
	const strip = (node: JSONContent): JSONContent | null => {
		if (node.type === "text") return null;
		// 다이어그램·차트·수식은 내용이 글자가 아니라 `value` 속성에 있다. 그것도 비운다.
		const attrs =
			node.type === "image"
				? { ...node.attrs, alt: "", caption: "", title: null }
				: typeof node.attrs?.value === "string"
					? { ...node.attrs, value: "" }
					: (node.attrs as JSONContent["attrs"]);
		const content = node.content?.map(strip).filter((child): child is JSONContent => child !== null);
		return { ...node, ...(attrs ? { attrs } : {}), ...(node.content ? { content } : {}) };
	};
	return strip(json) ?? { type: "doc", content: [] };
};

/** 셀 편집기가 바깥에 내보이는 조작. 단위를 옮기기 전에 쓴다. */
export interface CellEditorHandle {
	/** 저장하지 않은 변경이 있으면 저장한다. 저장할 수 없는 내용이면 false다. */
	flush: () => boolean;
}

export interface CellEditorProps {
	source: string;
	/** 저장된 번역. `null`이면 미번역이다. */
	target: string | null;
	editable: boolean;
	/** 처음 그릴 때 초점을 준다. */
	autoFocus?: boolean;
	onCommit: (target: string | null) => void;
	ref?: Ref<CellEditorHandle>;
}

interface BlockEditorProps extends CellEditorProps {
	type: string;
}

/** 서식이 없는 빈 뼈대 MDX. 이것과 같으면 비운 것으로 본다. */
const blankMdxOf = (source: string) => tiptapToMdx(blankLike(mdxToTiptap(source))).trim();

const actionButton = "h-7 px-2 text-xs";

export function BlockCellEditor({ type, source, target, editable, autoFocus, onCommit, ref }: BlockEditorProps) {
	const [extensions] = useState(() => buildEditorExtensions());
	const blank = useMemo(() => blankLike(mdxToTiptap(source)), [source]);
	const blankMdx = useMemo(() => blankMdxOf(source), [source]);
	const contentOf = (mdx: string | null) => (mdx ? mdxToTiptap(mdx) : blank);
	const [error, setError] = useState<string | null>(null);
	const [empty, setEmpty] = useState(() => !target);
	const [imageOpen, setImageOpen] = useState(false);
	const dirtyRef = useRef(false);
	/** 마지막으로 저장한(또는 저장돼 있던) 번역. Escape로 되돌릴 기준이다. */
	const committedRef = useRef(target);
	const isImage = type === "image";

	const isEmptyMdx = (mdx: string) => mdx === "" || mdx === blankMdx;

	const commitRef = useRef<() => boolean>(() => true);
	const editor = useEditor({
		immediatelyRender: false,
		editable,
		extensions,
		content: contentOf(target),
		editorProps: {
			// 줄바꿈 단축키(Mod-Enter)보다 먼저 받아 저장으로 쓴다.
			handleKeyDown: (view, event) => {
				if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || view.composing || event.isComposing)
					return false;
				event.preventDefault();
				commitRef.current();
				return true;
			},
			attributes: {
				"aria-label": "번역 편집기",
				class: cn(PROSE, "min-h-10 px-1 py-1 focus:outline-none [&_.tableWrapper]:overflow-x-auto"),
			},
		},
		onUpdate: ({ editor: current }) => {
			dirtyRef.current = true;
			setError(null);
			setEmpty(isEmptyMdx(tiptapToMdx(current.getJSON()).trim()));
		},
		onBlur: () => {
			commitRef.current();
		},
	});

	const load = (mdx: string | null) => {
		if (!editor) return;
		editor.commands.setContent(contentOf(mdx), { emitUpdate: false });
		dirtyRef.current = false;
		setError(null);
		setEmpty(!mdx || isEmptyMdx(tiptapToMdx(editor.getJSON()).trim()));
	};

	/** 바뀐 것이 있으면 저장한다. 저장할 수 없는 내용이면 오류를 보이고 false다. */
	const commit = () => {
		if (!editor || !dirtyRef.current) return true;
		const mdx = tiptapToMdx(editor.getJSON()).trim();
		if (isEmptyMdx(mdx)) {
			dirtyRef.current = false;
			if (committedRef.current !== null) {
				committedRef.current = null;
				onCommit(null);
			}
			return true;
		}
		const problem = validateFragment(mdx, type);
		if (problem) {
			setError(problem);
			return false;
		}
		dirtyRef.current = false;
		committedRef.current = mdx;
		onCommit(mdx);
		return true;
	};
	commitRef.current = commit;
	useImperativeHandle(ref, () => ({ flush: () => commitRef.current() }), []);

	const copySource = () => {
		load(source);
		committedRef.current = source;
		onCommit(source);
	};

	const swapImage = (image: ImageInsertion) => {
		if (!editor) return;
		editor
			.chain()
			.command(({ state, tr }) => {
				const node = state.doc.firstChild;
				if (node?.type.name !== "image") return false;
				tr.setNodeMarkup(0, undefined, {
					...node.attrs,
					mediaId: image.mediaId,
					src: null,
					alt: image.alt,
					caption: image.caption,
					decorative: image.decorative || null,
					crop: null,
					rotate: null,
				});
				return true;
			})
			.run();
		setImageOpen(false);
		commit();
	};

	useEffect(() => {
		editor?.setEditable(editable, false);
	}, [editor, editable]);

	// 밖에서 번역이 바뀌면(원문에 맞춰 다시 맞춤 등) 편집 중이 아닐 때 내용을 바꾼다.
	const previousTarget = useRef(target);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `load`는 매번 새로 만들어지지만 target이 바뀔 때만 다시 읽는다
	useEffect(() => {
		if (!editor || previousTarget.current === target) return;
		previousTarget.current = target;
		if (target === committedRef.current) return;
		committedRef.current = target;
		if (editor.isFocused || dirtyRef.current) return;
		load(target);
	}, [editor, target]);

	const focusedRef = useRef(false);
	useEffect(() => {
		if (!autoFocus || !editable || !editor || focusedRef.current) return;
		focusedRef.current = true;
		editor.commands.focus("end");
	}, [autoFocus, editable, editor]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: 셀 안 편집기의 키 처리를 모은다
		<div
			className="flex flex-col gap-2"
			onKeyDown={(event) => {
				if (!editable || event.nativeEvent.isComposing || !event.currentTarget.contains(event.target as Node)) return;
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					load(committedRef.current);
					editor?.commands.blur();
				}
			}}
		>
			<div className="relative rounded-md border focus-within:border-ring/60">
				<EditorContent editor={editor} />
				{empty && (
					<span
						className={cn(
							"pointer-events-none absolute left-1 text-muted-foreground text-sm",
							isImage ? "bottom-1" : "top-1",
						)}
					>
						미번역
					</span>
				)}
			</div>
			{error && (
				<p role="alert" className="text-destructive text-xs">
					{error}
				</p>
			)}
			{editable && (
				<div className="flex flex-wrap items-center gap-1">
					<Button type="button" size="sm" variant="outline" className={actionButton} onClick={copySource}>
						{isImage ? "원문 이미지로" : "원문 복사"}
					</Button>
					{isImage && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							className={actionButton}
							onClick={() => setImageOpen(true)}
						>
							이미지 바꾸기
						</Button>
					)}
					<span className="flex-1" />
					<Button type="button" size="sm" className={actionButton} onClick={commit}>
						저장
					</Button>
				</div>
			)}
			{editor && editable && <InlineBubble editor={editor} />}
			{isImage && editable && (
				<ImageInsertDialog
					open={imageOpen}
					initialFile={null}
					onClose={() => setImageOpen(false)}
					onInsert={swapImage}
				/>
			)}
		</div>
	);
}

export function HeaderCellEditor({ source, target, editable, autoFocus, onCommit, ref }: CellEditorProps) {
	const sourceHeader = parseHeader(source);
	const isTitle = sourceHeader !== null && "title" in sourceHeader;
	const sourceTexts = headerTexts(sourceHeader);
	const textsOf = (value: string | null) => {
		const parsed = value === null ? null : parseHeader(value);
		const same = parsed && "title" in parsed === isTitle ? headerTexts(parsed) : [];
		return sourceTexts.map((_, index) => same[index] ?? "");
	};
	const [values, setValues] = useState(() => textsOf(target));
	const valuesRef = useRef(values);
	/** 마지막으로 저장한(또는 저장돼 있던) 번역과 그 글자들. */
	const committedRef = useRef(target);
	const committedTextsRef = useRef(values);
	const composingRef = useRef(false);
	const pendingRef = useRef(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const firstInputRef = useRef<HTMLInputElement>(null);

	const show = (next: string[]) => {
		valuesRef.current = next;
		setValues(next);
	};

	const commit = () => {
		// 조합 중에는 끝내지 않는다. 조합이 끝나면 이어서 끝낸다.
		if (composingRef.current) {
			pendingRef.current = true;
			return true;
		}
		pendingRef.current = false;
		const next = valuesRef.current.map((value) => value.trim());
		if (next.every((value, index) => value === (committedTextsRef.current[index] ?? "").trim())) return true;
		committedTextsRef.current = next;
		const result = next.every((value) => !value)
			? null
			: JSON.stringify(isTitle ? { title: next[0] ?? "" } : { labels: next });
		committedRef.current = result;
		onCommit(result);
		return true;
	};
	const commitRef = useRef(commit);
	commitRef.current = commit;
	useImperativeHandle(ref, () => ({ flush: () => commitRef.current() }), []);

	const copySource = () => {
		show(sourceTexts);
		committedTextsRef.current = sourceTexts;
		committedRef.current = source;
		onCommit(source);
	};

	const previousTarget = useRef(target);
	// biome-ignore lint/correctness/useExhaustiveDependencies: target이 바뀔 때만 다시 읽는다
	useEffect(() => {
		if (previousTarget.current === target) return;
		previousTarget.current = target;
		if (target === committedRef.current) return;
		committedRef.current = target;
		if (rootRef.current?.contains(document.activeElement)) return;
		const next = textsOf(target);
		committedTextsRef.current = next;
		show(next);
	}, [target]);

	const focusedRef = useRef(false);
	useEffect(() => {
		if (!autoFocus || !editable || focusedRef.current) return;
		focusedRef.current = true;
		firstInputRef.current?.focus();
	}, [autoFocus, editable]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: 셀 안 입력들의 포커스 이동과 Escape를 모은다
		<div
			ref={rootRef}
			className="flex flex-col gap-1.5"
			onBlur={(event) => {
				// 같은 셀 안 다른 입력으로 옮길 때는 끝내지 않는다.
				if (!editable || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
				commit();
			}}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					show(committedTextsRef.current);
					(event.target as HTMLElement).blur();
				} else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
					event.preventDefault();
					commit();
				}
			}}
		>
			{sourceTexts.map((_, index) => (
				<Input
					// biome-ignore lint/suspicious/noArrayIndexKey: 탭 이름은 순서가 곧 정체성이다
					key={index}
					ref={index === 0 ? firstInputRef : undefined}
					aria-label={isTitle ? "제목" : `탭 이름 ${index + 1}`}
					value={values[index] ?? ""}
					placeholder="미번역"
					readOnly={!editable}
					className="h-8 text-sm"
					onChange={(event) => {
						const next = [...valuesRef.current];
						next[index] = event.target.value;
						show(next);
					}}
					onCompositionStart={() => {
						composingRef.current = true;
					}}
					onCompositionEnd={(event) => {
						composingRef.current = false;
						const next = [...valuesRef.current];
						next[index] = event.currentTarget.value;
						show(next);
						if (pendingRef.current) commit();
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.nativeEvent.isComposing) {
							event.preventDefault();
							commit();
						}
					}}
				/>
			))}
			{editable && (
				<div className="flex items-center gap-1">
					<Button type="button" size="sm" variant="outline" className={actionButton} onClick={copySource}>
						원문 복사
					</Button>
					<span className="flex-1" />
					<Button type="button" size="sm" className={actionButton} onClick={commit}>
						저장
					</Button>
				</div>
			)}
		</div>
	);
}
