// src/keystatic/fields/mdx-components/editor-mermaid-block.client.tsx
"use client";

import { Code2, Eye, ListOrdered, SquareSplitHorizontal, SquareSplitVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { NodeViewCodeEditor } from "../code-block/node-view-code-editor.client";
import type { MermaidNodeViewProps } from "./component";
import { Mermaid } from "./mermaid.client";

export function MermaidBlockNodeView({ children, onRemove }: MermaidNodeViewProps) {
	const [chart, setChart] = useState<string>("");
	const [useLineNumber, setUseLineNumber] = useState(false);

	const handleLineNumberChange = (pressed: boolean) => {
		setUseLineNumber(pressed);
	};

	const handleChartChange = (chart: string) => {
		setChart(chart.trim());
	};

	return (
		<Tabs defaultValue="bothVertical" className="w-full">
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
					<Toggle size={"sm"} variant={"outline"} pressed={useLineNumber} onPressedChange={handleLineNumberChange}>
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
					lang="tsx"
					useLineNumber={useLineNumber}
					onCodeChange={handleChartChange}
				/>
			</TabsContent>
			<TabsContent value="preview">
				<Mermaid chart={chart} />
			</TabsContent>
			<TabsContent value="bothVertical">
				<NodeViewCodeEditor
					nodeViewChildren={children}
					lang="tsx"
					useLineNumber={useLineNumber}
					onCodeChange={handleChartChange}
				/>
				<Mermaid chart={chart} />
			</TabsContent>
			<TabsContent value="bothHorizontal" className="flex w-full *:flex-1">
				<NodeViewCodeEditor
					nodeViewChildren={children}
					lang="tsx"
					useLineNumber={useLineNumber}
					onCodeChange={handleChartChange}
				/>
				<Mermaid chart={chart} className="py-0" />
			</TabsContent>
		</Tabs>
	);
}
