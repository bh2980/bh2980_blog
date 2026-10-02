"use client";

import { tabs as tabsDefinition } from "@bh2980/cms/blocks/definitions";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { PencilLine, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils/cn";
import { Button } from "../../../ui/button";
import {
	AttributeInput,
	ContainerToolbar,
	childPos,
	focusInside,
	useContainerValues,
	useSelectedChildIndex,
	valuesOf,
	withValue,
} from "./shared";

const MIN_TABS = tabsDefinition.children.min;
const MAX_TABS = tabsDefinition.children.max;

/**
 * 고른 탭만 남기고 나머지 탭 본문을 숨긴다. 자식 탭은 contentDOM(`data-node-view-content-react`)의 직계 자식이다.
 * Tailwind가 클래스를 찾을 수 있게 문자열을 그대로 적는다(최대 8개, 정의의 `children.max`).
 */
const SHOW_ONLY_TAB = [
	"[&>[data-node-view-content-react]>:not(:nth-child(1))]:hidden",
	"[&>[data-node-view-content-react]>:not(:nth-child(2))]:hidden",
	"[&>[data-node-view-content-react]>:not(:nth-child(3))]:hidden",
	"[&>[data-node-view-content-react]>:not(:nth-child(4))]:hidden",
	"[&>[data-node-view-content-react]>:not(:nth-child(5))]:hidden",
	"[&>[data-node-view-content-react]>:not(:nth-child(6))]:hidden",
	"[&>[data-node-view-content-react]>:not(:nth-child(7))]:hidden",
	"[&>[data-node-view-content-react]>:not(:nth-child(8))]:hidden",
] as const;

// 공개 화면(src/components/mdx/tabs.tsx + ui/tabs)의 탭 모양과 맞춘다.
const TAB_TRIGGER =
	"relative inline-flex h-[calc(100%-1px)] items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent px-2 py-1 font-medium text-foreground/60 text-sm transition-all hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground";
const TAB_TRIGGER_ACTIVE =
	"border-border! bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30 dark:text-foreground";

const labelOf = (values: Record<string, unknown>) => (typeof values.label === "string" ? values.label : "");

/**
 * 공개 화면처럼 탭 바와 고른 탭의 본문만 보여 준다. 본문은 그 자리에서 고친다.
 * 탭을 누르면 그 탭 본문으로 커서가 가고, 방향키로 다른 탭 본문에 들어가면 그 탭이 열린다.
 * 탭 이름은 두 번 눌러 바꾼다.
 */
export function TabsNodeView(props: NodeViewProps) {
	const { node, selected, editor, getPos } = props;
	const [values] = useContainerValues(props);
	const labels = Array.from({ length: node.childCount }, (_, index) => labelOf(valuesOf(node.child(index))));
	const defaultLabel = typeof values.defaultValue === "string" ? values.defaultValue : "";
	const defaultIndex = Math.max(0, labels.indexOf(defaultLabel));
	const [active, setActive] = useState(defaultIndex);
	const [renaming, setRenaming] = useState<number | null>(null);
	const selectedIndex = useSelectedChildIndex(editor, getPos);
	const current = Math.min(active, node.childCount - 1);
	const editable = editor.isEditable;

	useEffect(() => {
		if (selectedIndex !== -1) setActive(selectedIndex);
	}, [selectedIndex]);

	const openTab = (index: number) => {
		setActive(index);
		focusInside(editor, getPos, index);
	};

	const renameTab = (index: number, label: string) => {
		const pos = getPos();
		if (typeof pos !== "number") return;
		editor
			.chain()
			.command(({ tr }) => {
				const parent = tr.doc.nodeAt(pos);
				const child = parent?.maybeChild(index);
				if (!parent || !child) return false;
				const previous = labelOf(valuesOf(child));
				tr.setNodeMarkup(childPos(parent, pos, index), undefined, {
					...child.attrs,
					values: withValue(valuesOf(child), "label", label),
				});
				// 처음 열 탭은 이름으로 가리킨다. 이름을 바꾸면 함께 바꾼다(렌더 시점이 아닌 지금 문서 기준).
				const parentValues = valuesOf(parent);
				if (parentValues.defaultValue && parentValues.defaultValue === previous)
					tr.setNodeMarkup(pos, undefined, {
						...parent.attrs,
						values: withValue(parentValues, "defaultValue", label),
					});
				return true;
			})
			.run();
	};

	const addTab = () => {
		const pos = getPos();
		if (typeof pos !== "number" || node.childCount >= MAX_TABS) return;
		let number = node.childCount + 1;
		while (labels.includes(`탭 ${number}`)) number += 1;
		editor.commands.insertContentAt(pos + node.nodeSize - 1, {
			type: "cmsTab",
			attrs: { values: { label: `탭 ${number}` } },
			content: [{ type: "paragraph" }],
		});
		openTab(node.childCount);
	};

	const removeTab = (index: number) => {
		const pos = getPos();
		if (typeof pos !== "number" || node.childCount <= MIN_TABS) return;
		const from = childPos(node, pos, index);
		editor
			.chain()
			.command(({ tr }) => {
				tr.delete(from, from + node.child(index).nodeSize);
				if (defaultLabel && defaultLabel === labels[index])
					tr.setNodeMarkup(pos, undefined, { ...node.attrs, values: withValue(values, "defaultValue", "") });
				return true;
			})
			.run();
		openTab(Math.max(0, index - 1));
	};

	const toggleDefault = (index: number) => {
		const pos = getPos();
		if (typeof pos !== "number") return;
		// 첫 탭은 따로 적지 않아도 처음 열린다. 이미 지정된 탭을 다시 누르면 지정을 푼다.
		const next = index === 0 || index === defaultIndex ? "" : (labels[index] ?? "");
		editor.view.dispatch(
			editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, values: withValue(values, "defaultValue", next) }),
		);
	};

	return (
		<NodeViewWrapper
			data-cms-container-node="cmsTabs"
			data-cms-framed
			className={cn("group/container relative my-6 rounded-lg", selected && "ring-2 ring-ring")}
		>
			<div contentEditable={false} className="not-prose">
				<div
					role="tablist"
					aria-label="탭"
					className="relative inline-flex h-9 w-fit max-w-full items-center rounded-lg rounded-b-none border bg-muted p-[3px] text-muted-foreground"
				>
					{labels.map((label, index) =>
						renaming === index ? (
							// biome-ignore lint/suspicious/noArrayIndexKey: 탭 위치가 곧 식별자다(이름은 겹칠 수 있다).
							<div key={index} className={cn(TAB_TRIGGER, TAB_TRIGGER_ACTIVE)}>
								<AttributeInput
									aria-label="탭 이름"
									value={label}
									required
									autoFocus
									size={Math.max(4, label.length + 1)}
									onCommit={(next) => renameTab(index, next)}
									onEnter={() => {
										setRenaming(null);
										openTab(index);
									}}
									onEscape={() => setRenaming(null)}
									onBlur={() => setRenaming(null)}
									className="text-center"
								/>
							</div>
						) : (
							<button
								// biome-ignore lint/suspicious/noArrayIndexKey: 탭 위치가 곧 식별자다(이름은 겹칠 수 있다).
								key={index}
								type="button"
								role="tab"
								aria-selected={index === current}
								className={cn(TAB_TRIGGER, index === current && TAB_TRIGGER_ACTIVE)}
								// 두 번 누르기의 두 번째 클릭은 탭을 다시 열지 않는다. 다시 열면 예약된 편집기 포커스가 이름 입력 칸을 빼앗는다.
								onClick={(event) => event.detail < 2 && openTab(index)}
								onDoubleClick={() => editable && setRenaming(index)}
								title={editable ? "두 번 눌러 이름 바꾸기" : undefined}
							>
								{label || "이름 없음"}
								{index === defaultIndex && defaultLabel ? (
									<Star className="size-3 fill-current opacity-60" aria-label="처음 열 탭" />
								) : null}
							</button>
						),
					)}
					<span className="pointer-events-none absolute right-0 -bottom-1 left-0 inline-block h-1 bg-muted" />
				</div>
			</div>
			<NodeViewContent
				className={cn("rounded-b-lg rounded-tr-lg border bg-muted px-4 py-3 text-sm", SHOW_ONLY_TAB[current])}
			/>
			{editable ? (
				<ContainerToolbar label="탭 도구">
					<Button
						type="button"
						size="icon-xs"
						variant="ghost"
						aria-label="탭 추가"
						title="탭 추가"
						disabled={node.childCount >= MAX_TABS}
						onClick={addTab}
					>
						<Plus aria-hidden />
					</Button>
					<Button
						type="button"
						size="icon-xs"
						variant="ghost"
						aria-label="이 탭 이름 바꾸기"
						title="이 탭 이름 바꾸기"
						onClick={() => setRenaming(current)}
					>
						<PencilLine aria-hidden />
					</Button>
					<Button
						type="button"
						size="icon-xs"
						variant="ghost"
						aria-label="이 탭을 처음 열기"
						title="이 탭을 처음 열기"
						aria-pressed={current === defaultIndex}
						className="aria-pressed:text-amber-500"
						onClick={() => toggleDefault(current)}
					>
						<Star aria-hidden className={cn(current === defaultIndex && "fill-current")} />
					</Button>
					<Button
						type="button"
						size="icon-xs"
						variant="ghost"
						aria-label="이 탭 삭제"
						title="이 탭 삭제"
						disabled={node.childCount <= MIN_TABS}
						onClick={() => removeTab(current)}
					>
						<Trash2 aria-hidden />
					</Button>
				</ContainerToolbar>
			) : null}
		</NodeViewWrapper>
	);
}

/** 탭 하나. 모양은 부모(탭 바·본문 상자)가 맡고, 이 뷰는 본문 자리만 둔다. */
export function TabNodeView() {
	return (
		<NodeViewWrapper data-cms-container-node="cmsTab">
			<NodeViewContent className="[&>[data-node-view-content-react]>:first-child]:mt-0 [&>[data-node-view-content-react]>:last-child]:mb-0" />
		</NodeViewWrapper>
	);
}
