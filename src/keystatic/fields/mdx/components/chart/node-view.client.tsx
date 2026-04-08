"use client";

import { Code2, Eye, SquareSplitHorizontal, SquareSplitVertical, Trash2 } from "lucide-react";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { toString as mdastToString } from "mdast-util-to-string";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnnotationConfig } from "@/libs/annotation/code-block/types";
import { cn } from "@/utils/cn";
import { useLiveCodeBlockNode } from "../../hooks/use-live-code-block-node";
import { NodeViewCodeEditor } from "../code-block/components";
import type { ChartNodeViewProps } from "./component";
import { Chart } from "./chart.client";

const EMPTY_ANNOTATION_CONFIG: AnnotationConfig = { annotations: [] };

const extractChartDslFromFlowElement = (node: MdxJsxFlowElement): string => {
	const lines: string[] = [];

	for (const child of node.children) {
		if (child.type !== "paragraph") {
			continue;
		}

		lines.push(mdastToString(child));
	}

	return lines.join("\n");
};

export function ChartNodeView({ children, onRemove, onChange, isSelected, value }: ChartNodeViewProps) {
	const chartNode = useLiveCodeBlockNode(value.id);
	const [chartSource, setChartSource] = useState("");

	const initProseMirrorId = (id: string) => {
		onChange({ ...value, id });
	};

	useEffect(() => {
		if (!chartNode) {
			return;
		}

		setChartSource(extractChartDslFromFlowElement(chartNode));
	}, [chartNode]);

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
					<Button type="button" variant="destructive" size="icon-sm" onClick={onRemove} aria-label="차트 블럭 삭제">
						<Trash2 className="h-4 w-4" />
					</Button>
				</ButtonGroup>
			</div>
			<TabsContent value="code">
				<NodeViewCodeEditor
					nodeViewChildren={children}
					lang="txt"
					overrideHighlightLang="txt"
					initProseMirrorId={initProseMirrorId}
					proseMirrorId={value.id}
					annotationConfig={EMPTY_ANNOTATION_CONFIG}
				/>
			</TabsContent>
			<TabsContent value="preview">
				<Chart source={chartSource} />
			</TabsContent>
			<TabsContent value="bothVertical">
				<NodeViewCodeEditor
					nodeViewChildren={children}
					lang="txt"
					overrideHighlightLang="txt"
					initProseMirrorId={initProseMirrorId}
					proseMirrorId={value.id}
					annotationConfig={EMPTY_ANNOTATION_CONFIG}
				/>
				<Chart source={chartSource} />
			</TabsContent>
			<TabsContent value="bothHorizontal" className="flex w-full gap-3 *:flex-1">
				<NodeViewCodeEditor
					nodeViewChildren={children}
					lang="txt"
					overrideHighlightLang="txt"
					initProseMirrorId={initProseMirrorId}
					proseMirrorId={value.id}
					annotationConfig={EMPTY_ANNOTATION_CONFIG}
				/>
				<Chart source={chartSource} />
			</TabsContent>
		</Tabs>
	);
}
