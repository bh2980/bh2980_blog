"use client";

import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Check } from "lucide-react";
import { useState } from "react";
import { callout } from "@/cms/blocks/definitions";
import { CALLOUT_ICON_BY_VARIANT, type CalloutVariant, getDefaultCalloutTitle } from "@/components/mdx/callout";
import { Alert } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils/cn";
import { AttributeInput, focusInside, useContainerValues } from "./shared";

const VARIANT_OPTIONS = callout.attributes.variant.options as Record<CalloutVariant, string>;
const isVariant = (value: unknown): value is CalloutVariant => typeof value === "string" && value in VARIANT_OPTIONS;

/** 공개 화면의 콜아웃과 같은 모양. 제목은 그 자리에서, 종류는 아이콘을 눌러 바꾼다. */
export function CalloutNodeView(props: NodeViewProps) {
	const { node, selected, editor, getPos } = props;
	const [values, setValue] = useContainerValues(props);
	const [variantOpen, setVariantOpen] = useState(false);
	const variant = isVariant(values.variant) ? values.variant : "note";
	const Icon = CALLOUT_ICON_BY_VARIANT[variant];
	node.childCount === 1 && node.firstChild?.type.name === "paragraph" && !node.firstChild.content.size;
	const editable = editor.isEditable;

	return (
		<NodeViewWrapper
			data-cms-container-node="cmsCallout"
			data-cms-framed
			className={cn("group/container relative my-6 rounded-lg", selected && "ring-2 ring-ring")}
		>
			<Alert variant={variant} layout="stack" role="note" className="not-prose w-full">
				<div className="flex items-center gap-2" contentEditable={false}>
					<Popover open={variantOpen} onOpenChange={setVariantOpen}>
						<PopoverTrigger
							disabled={!editable}
							render={
								<button
									type="button"
									className="-m-1 rounded p-1 text-current hover:bg-current/10"
									aria-label={`콜아웃 종류: ${VARIANT_OPTIONS[variant]}`}
								/>
							}
						>
							<Icon className="size-4 shrink-0" />
						</PopoverTrigger>
						<PopoverContent className="w-44 gap-0 p-1" side="bottom" align="start">
							{Object.entries(VARIANT_OPTIONS).map(([key, label]) => {
								const OptionIcon = CALLOUT_ICON_BY_VARIANT[key as CalloutVariant];
								return (
									<button
										key={key}
										type="button"
										className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
										onClick={() => {
											setValue("variant", key);
											setVariantOpen(false);
										}}
									>
										<OptionIcon className="size-4" />
										<span className="flex-1">{label}</span>
										{key === variant ? <Check className="size-3.5" aria-hidden /> : null}
									</button>
								);
							})}
						</PopoverContent>
					</Popover>
					<AttributeInput
						aria-label="콜아웃 제목"
						value={typeof values.title === "string" ? values.title : ""}
						placeholder={getDefaultCalloutTitle(variant)}
						readOnly={!editable}
						onCommit={(title) => setValue("title", title)}
						onEnter={() => focusInside(editor, getPos)}
						onEscape={() => focusInside(editor, getPos)}
						className="flex-1 font-medium tracking-tight"
					/>
				</div>
				{/* 안쪽 블록(react-renderer로 감싸진 커스텀 블록)의 위아래 여백이 상자 안쪽 여백에 더해지지 않게 첫·끝 자식은 0으로 둔다. */}
				<NodeViewContent className="mt-2 text-current text-sm [&>[data-node-view-content-react]>:first-child>[data-node-view-wrapper]]:mt-0 [&>[data-node-view-content-react]>:last-child>[data-node-view-wrapper]]:mb-0 [&_p]:m-0 [&_p]:leading-relaxed" />
			</Alert>
		</NodeViewWrapper>
	);
}
