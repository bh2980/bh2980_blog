"use client";

import type { BlockDefinition } from "@bh2980/cms/client";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import type { ReactNode } from "react";
import { useCmsAdminComponents } from "../../../admin-components";
import { cn } from "../../../lib/utils/cn";
import { AttributeInput, type ContainerValues, useContainerValues } from "../containers/shared";
import { customBlockOfNode, isContainer } from "./shared";

/** 사이트가 사용자 블록에 등록하는 편집 컴포넌트가 받는 값(`CmsAdminComponents.blockEditors`). */
export interface CustomBlockEditorProps {
	readonly definition: BlockDefinition;
	/** 지시자 속성 값. 비운 값(빈 문자열·false)은 저장하지 않는다. */
	readonly values: Readonly<ContainerValues>;
	readonly setValue: (name: string, value: string | boolean) => void;
	/** 컨테이너 블록의 본문 자리. 본문을 둘 곳에 그린다. 한 줄 블록은 `null`. */
	readonly content: ReactNode;
	readonly editable: boolean;
	readonly selected: boolean;
}

/** 속성 하나의 기본 입력. 선택 값이 있으면 고르는 칸, 참·거짓이면 체크, 나머지는 한 줄 입력이다. */
function AttributeField({
	name,
	definition,
	values,
	setValue,
	editable,
}: {
	name: string;
	definition: BlockDefinition;
	values: ContainerValues;
	setValue: (name: string, value: string | boolean) => void;
	editable: boolean;
}) {
	const attribute = definition.attributes[name];
	if (!attribute) return null;
	const value = values[name] ?? attribute.defaultValue ?? (attribute.type === "boolean" ? false : "");
	const id = `${definition.name}-${name}`;
	if (attribute.type === "boolean") {
		return (
			<label htmlFor={id} className="flex items-center gap-1.5 text-xs">
				<input
					id={id}
					type="checkbox"
					checked={value === true}
					disabled={!editable}
					onChange={(event) => setValue(name, event.target.checked)}
				/>
				{attribute.label}
			</label>
		);
	}
	if (attribute.options) {
		return (
			<label htmlFor={id} className="flex items-center gap-1.5 text-xs">
				{attribute.label}
				<select
					id={id}
					value={String(value)}
					disabled={!editable}
					onChange={(event) => setValue(name, event.target.value)}
					className="rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
				>
					{Object.entries(attribute.options).map(([option, label]) => (
						<option key={option} value={option}>
							{label}
						</option>
					))}
				</select>
			</label>
		);
	}
	return (
		<label htmlFor={id} className="flex min-w-40 flex-1 items-center gap-1.5 text-xs">
			<span className="shrink-0">{attribute.label}</span>
			<AttributeInput
				id={id}
				value={String(value)}
				readOnly={!editable}
				placeholder={attribute.description}
				onCommit={(next) => setValue(name, next)}
				className="min-w-0 flex-1 rounded border border-slate-200 bg-transparent px-1.5 py-0.5 dark:border-slate-700"
			/>
		</label>
	);
}

/** 등록한 편집 컴포넌트가 없을 때의 기본 모양: 블록 이름과 속성 입력, 그 아래 본문. */
function DefaultCustomBlockEditor({ definition, values, setValue, content, editable }: CustomBlockEditorProps) {
	const names = Object.keys(definition.attributes);
	return (
		<>
			<div
				contentEditable={false}
				className="not-prose flex flex-wrap items-center gap-x-3 gap-y-1.5 border-slate-200 border-b px-3 py-2 text-slate-600 dark:border-slate-700 dark:text-slate-300"
			>
				<span className="font-medium text-xs">{definition.label}</span>
				{names.map((name) => (
					<AttributeField
						key={name}
						name={name}
						definition={definition}
						values={values}
						setValue={setValue}
						editable={editable}
					/>
				))}
			</div>
			{content && <div className="px-3">{content}</div>}
		</>
	);
}

/** 사용자 블록의 NodeView. 사이트가 등록한 편집 컴포넌트(`blockEditors[블록 이름]`)가 있으면 그것으로 그린다. */
export function CustomBlockNodeView(props: NodeViewProps) {
	const { node, selected, editor } = props;
	const definition = customBlockOfNode(node.type.name);
	const [values, setValue] = useContainerValues(props);
	const { blockEditors } = useCmsAdminComponents();
	if (!definition) return <NodeViewWrapper />;
	const Editor = blockEditors?.[definition.name] ?? DefaultCustomBlockEditor;
	return (
		<NodeViewWrapper
			data-cms-custom-block={definition.name}
			data-cms-framed
			className={cn(
				"relative my-6 rounded-md border border-slate-200 dark:border-slate-700",
				selected && "ring-2 ring-ring",
			)}
		>
			<Editor
				definition={definition}
				values={values}
				setValue={setValue}
				content={isContainer(definition) ? <NodeViewContent /> : null}
				editable={editor.isEditable}
				selected={selected}
			/>
		</NodeViewWrapper>
	);
}
