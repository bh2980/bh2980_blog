"use client";

import type { Root } from "hast";
import { ListOrdered, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Toggle } from "@/components/ui/toggle";
import { type AnnotationConfig, extractAnnotationsFromAst } from "@/keystatic/libs/serialize-annotations";
import { highlight } from "@/libs/shiki/code-highligher";
import { cn } from "@/utils/cn";
import { isDefined } from "@/utils/is-defined";
import { useLiveCodeBlockNode } from "../../hooks/use-live-code-block-node";
import { BlurChangeInput } from "./blur-change-input.client";
import type { CodeBlockNodeViewProps } from "./component";
import { HastView } from "./hast-view";
import { LanguageSelector } from "./language-selector";

const CodeBlockToolbar = ({ value, onChange, onRemove }: CodeBlockNodeViewProps) => {
	const title = value.meta.title;

	const handleLineNumberChange = (showLineNumbers: boolean) =>
		onChange({ ...value, meta: { ...value.meta, showLineNumbers } });
	const handleBlurTitle = (title: string) => onChange({ ...value, meta: { ...value.meta, title } });

	return (
		<div className="flex justify-between">
			<div className="flex gap-2">
				<LanguageSelector value={value} onChange={onChange} />
				<BlurChangeInput defaultValue={title} onBlur={handleBlurTitle} />
			</div>
			<ButtonGroup>
				<Toggle
					size={"sm"}
					variant={"outline"}
					pressed={value.meta.showLineNumbers}
					onPressedChange={handleLineNumberChange}
				>
					<ListOrdered />
				</Toggle>
				<Button variant={"destructive"} onClick={onRemove} size="icon-sm">
					<Trash2 />
				</Button>
			</ButtonGroup>
		</div>
	);
};

export const CodeBlockNodeView = (props: CodeBlockNodeViewProps) => {
	const codeBlockNode = useLiveCodeBlockNode(props.value.id);
	const [hast, setHast] = useState<Root>();

	// biome-ignore lint/correctness/useExhaustiveDependencies: id가 없을 경우에 최초 부여용
	useEffect(() => {
		if (props.value.id) {
			return;
		}

		const id = crypto.randomUUID();

		props.onChange({ ...props.value, id });
	}, [props.value.id]);

	useEffect(() => {
		if (!codeBlockNode) {
			return;
		}

		const result = extractAnnotationsFromAst(codeBlockNode, keystaticAnnotationConfig);

		if (!isDefined(result?.code)) {
			return;
		}

		const highlighedHast = highlight(result.code, props.value.lang, {});

		setHast(highlighedHast);
	}, [codeBlockNode, props.value.lang]);

	return (
		<div className={cn("flex flex-col gap-2 rounded-lg", props.isSelected && "outline-2 outline-offset-8")}>
			<CodeBlockToolbar {...props} />
			<div className="relative rounded-lg *:m-0!" style={{ backgroundColor: "rgb(40, 44, 52)" }}>
				<pre
					className={cn(
						"relative z-20 w-full outline-none",
						"bg-transparent! text-transparent! caret-white!",
						props.value.meta.showLineNumbers && "[&_p]:pl-7!",
					)}
				>
					{props.children}
				</pre>
				{hast && <HastView hast={hast} showLineNumbers={props.value.meta.showLineNumbers} />}
			</div>
		</div>
	);
};

export const keystaticAnnotationConfig: AnnotationConfig = {
	decoration: [
		{
			name: "Tooltip",
			source: "mdx-text",
			class: "underline underline-dotted",
		},
		{
			name: "strong",
			source: "mdast",
			class: "font-bold",
		},
		{
			name: "emphasis",
			source: "mdast",
			class: "italic",
		},
		{
			name: "delete",
			source: "mdast",
			class: "line-through",
		},
		{
			name: "u",
			source: "mdx-text",
			class: "underline",
		},
	],
};
