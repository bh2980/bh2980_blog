"use client";

import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { BLOCKS } from "@/cms/blocks/definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils/cn";

const DEFINITION_BY_NODE = new Map<string, (typeof BLOCKS)[number]>(
	BLOCKS.flatMap((block) => ("nodeView" in block.editor ? [[block.editor.nodeView, block] as const] : [])),
);

/** 본문은 contentDOM에서 직접 편집하고 속성만 B3 정의의 폼으로 바꾼다(v2 C3). */
export function ContainerNodeView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
	const viewName = node.type.name.replace(/^cms/, "");
	const definition = DEFINITION_BY_NODE.get(viewName[0]?.toLowerCase() + viewName.slice(1));
	const [open, setOpen] = useState(false);
	const values = (node.attrs.values ?? {}) as Record<string, string | boolean>;
	const setValue = (key: string, value: string | boolean) => {
		updateAttributes({ values: { ...values, [key]: value } });
	};

	const isColumns = node.type.name === "cmsColumns";
	const isTabs = node.type.name === "cmsTabs";
	const addChild = () => {
		const pos = getPos();
		if (typeof pos !== "number") return;
		const childType = isTabs ? "cmsTab" : "cmsColumn";
		editor.commands.insertContentAt(pos + 1 + node.content.size, {
			type: childType,
			...(isTabs ? { attrs: { values: { label: `탭 ${node.childCount + 1}` } } } : {}),
			content: [{ type: "paragraph", content: [{ type: "text", text: "내용을 입력하세요" }] }],
		});
	};
	const removeChild = () => {
		const pos = getPos();
		if (typeof pos !== "number" || node.childCount <= 2) return;
		const last = node.lastChild;
		if (last)
			editor.commands.deleteRange({
				from: pos + 1 + node.content.size - last.nodeSize,
				to: pos + 1 + node.content.size,
			});
	};
	const isChild = node.type.name === "cmsTab" || node.type.name === "cmsColumn";
	const label = definition?.label ?? node.type.name.replace(/^cms/, "");

	return (
		<NodeViewWrapper
			className={cn("my-3 rounded-lg border border-border bg-card", selected && "ring-2 ring-ring", isChild && "my-1")}
			data-cms-container-node={node.type.name}
		>
			<div className="flex items-center justify-between gap-2 border-border border-b px-3 py-2" contentEditable={false}>
				<span className="truncate font-medium text-muted-foreground text-sm">
					{label}
					{typeof values.label === "string" && values.label ? ` · ${values.label}` : ""}
				</span>
				{(isTabs || isColumns) && (
					<div className="flex gap-1">
						<Button
							type="button"
							size="xs"
							variant="outline"
							onClick={addChild}
							disabled={node.childCount >= (isTabs ? 8 : 4)}
							aria-label={`${label} 추가`}
						>
							추가
						</Button>
						<Button
							type="button"
							size="xs"
							variant="outline"
							onClick={removeChild}
							disabled={node.childCount <= 2}
							aria-label={`${label} 마지막 항목 제거`}
						>
							제거
						</Button>
					</div>
				)}
				{definition && Object.keys(definition.attributes).length > 0 && (
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger
							render={<Button type="button" size="icon-xs" variant="ghost" aria-label={`${label} 설정`} />}
						>
							<Settings2 aria-hidden="true" />
						</PopoverTrigger>
						<PopoverContent className="w-72 space-y-3" side="bottom" align="start">
							<p className="font-semibold text-sm">{label} 설정</p>
							{Object.entries(definition.attributes).map(([name, attribute]) => (
								<div key={name} className="flex flex-col gap-1 text-sm">
									<span>{attribute.label}</span>
									{attribute.type === "boolean" ? (
										<input
											type="checkbox"
											checked={values[name] === true}
											onChange={(event) => setValue(name, event.target.checked)}
										/>
									) : "input" in attribute && attribute.input === "textarea" ? (
										<textarea
											aria-label={attribute.label}
											value={String(values[name] ?? "")}
											onChange={(event) => setValue(name, event.target.value)}
											className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-foreground"
										/>
									) : attribute.options ? (
										<select
											aria-label={attribute.label}
											value={String(values[name] ?? attribute.defaultValue ?? "")}
											onChange={(event) => setValue(name, event.target.value)}
											className="h-9 rounded-md border border-input bg-background px-2 text-foreground"
										>
											<option value="">선택</option>
											{Object.entries(attribute.options).map(([value, title]) => (
												<option key={value} value={value}>
													{String(title)}
												</option>
											))}
										</select>
									) : (
										<Input
											value={String(values[name] ?? "")}
											onChange={(event) => setValue(name, event.target.value)}
											aria-label={attribute.label}
										/>
									)}
								</div>
							))}
						</PopoverContent>
					</Popover>
				)}
			</div>
			<NodeViewContent
				as="div"
				className={cn("min-h-12 p-3", isColumns && "flex flex-col gap-3 md:flex-row [&>_*]:min-w-0 [&>_*]:flex-1")}
			/>
		</NodeViewWrapper>
	);
}
