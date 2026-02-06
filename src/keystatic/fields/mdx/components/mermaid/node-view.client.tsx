// src/keystatic/fields/mdx-components/editor-mermaid-block.client.tsx
"use client";

import { Code2, Eye, ListOrdered, SquareSplitHorizontal, SquareSplitVertical, Trash2 } from "lucide-react";
import { toString } from "mdast-util-to-string";
import type { PhrasingContent } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/utils/cn";
import { useLiveCodeBlockNode } from "../../hooks/use-live-code-block-node";
import { NodeViewCodeEditor } from "../code-block/components";
import type { MermaidNodeViewProps } from "./component";
import { Mermaid } from "./mermaid.client";

const extractMermaidCodeFromFlowElement = (node: MdxJsxFlowElement): string => {
	const lines: string[] = [];

	const visitFlowChildren = (children: MdxJsxFlowElement["children"]) => {
		for (const child of children) {
			if (child.type === "paragraph") {
				lines.push(toString(child as unknown as { children: PhrasingContent[] }));
				continue;
			}

			if (child.type === "mdxJsxFlowElement") {
				visitFlowChildren(child.children as MdxJsxFlowElement["children"]);
			}
		}
	};

	visitFlowChildren(node.children);
	return lines.join("\n");
};

export function MermaidBlockNodeView({ children, onRemove, onChange, isSelected, value }: MermaidNodeViewProps) {
	const codeBlockNode = useLiveCodeBlockNode(value.id);
	const [chart, setChart] = useState<string>("");
	const [showLineNumbers, setShowLineNumbers] = useState(false);

	const initProseMirrorId = (id: string) => {
		onChange({ ...value, id });
	};

	useEffect(() => {
		if (!codeBlockNode) {
			return;
		}

		setChart(extractMermaidCodeFromFlowElement(codeBlockNode));
	}, [codeBlockNode]);

	return (
		<Tabs defaultValue="bothVertical" className={cn("w-full rounded-xl", isSelected && "outline-2 outline-offset-8")}>
			<div className="flex items-center justify-between gap-2">
				<TabsList>
					<TabsTrigger value="code">
						<Code2 />
					</TabsTrigger>
					<TabsTrigger value="preview">
						<Eye />
					</TabsTrigger>
					<TabsTrigger value="bothVertical">
						<SquareSplitVertical />
					</TabsTrigger>
					<TabsTrigger value="bothHorizontal">
						<SquareSplitHorizontal />
					</TabsTrigger>
				</TabsList>
				<ButtonGroup>
					<Toggle size={"sm"} variant={"outline"} pressed={showLineNumbers} onPressedChange={setShowLineNumbers}>
						<ListOrdered />
					</Toggle>
					<Button type="button" variant="destructive" size="icon-sm" onClick={onRemove} aria-label="머메이드 블록 삭제">
						<Trash2 className="h-4 w-4" />
					</Button>
				</ButtonGroup>
			</div>
			<TabsContent value="code">
				<NodeViewCodeEditor
					nodeViewChildren={children}
					lang="mermaid"
					showLineNumbers={showLineNumbers}
					initProseMirrorId={initProseMirrorId}
					proseMirrorId={value.id}
				/>
			</TabsContent>
			<TabsContent value="preview">
				<Mermaid chart={chart} />
			</TabsContent>
			<TabsContent value="bothVertical">
				<NodeViewCodeEditor
					nodeViewChildren={children}
					lang="mermaid"
					showLineNumbers={showLineNumbers}
					initProseMirrorId={initProseMirrorId}
					proseMirrorId={value.id}
				/>
				<Mermaid chart={chart} />
			</TabsContent>
			<TabsContent value="bothHorizontal" className="flex w-full *:flex-1">
				<NodeViewCodeEditor
					nodeViewChildren={children}
					lang="mermaid"
					showLineNumbers={showLineNumbers}
					initProseMirrorId={initProseMirrorId}
					proseMirrorId={value.id}
				/>
				<Mermaid chart={chart} className="py-0" />
			</TabsContent>
		</Tabs>
	);
}
