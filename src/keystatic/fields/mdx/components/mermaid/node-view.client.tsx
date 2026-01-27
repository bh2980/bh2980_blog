// src/keystatic/fields/mdx-components/editor-mermaid-block.client.tsx
"use client";

import { Code2, Eye, ListOrdered, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { BlurChangeInput } from "../code-block/blur-change-input.client";
import { NodeViewCodeEditor } from "../code-block/node-view-code-editor.client";
import type { MermaidNodeViewProps } from "./component";
import { Mermaid } from "./mermaid.client";

export function MermaidBlockNodeView({ children, onRemove, onChange, value }: MermaidNodeViewProps) {
	const [chart, setChart] = useState<string>("");
	const [useLineNumber, setUseLineNumber] = useState(false);

	const handleLineNumberChange = (pressed: boolean) => {
		setUseLineNumber(pressed);
	};

	const handleBlurInput = (title: string) => {
		onChange({ ...value, title });
	};

	const handleChartChange = (chart: string) => {
		setChart(chart.trim());
	};

	return (
		<Tabs defaultValue="code" className="w-full">
			<div className="flex items-center justify-between gap-2">
				<div className="flex gap-2">
					<TabsList className="w-fit">
						<TabsTrigger value="code">
							<Code2 />
						</TabsTrigger>
						<TabsTrigger value="preview">
							<Eye />
						</TabsTrigger>
					</TabsList>
					<BlurChangeInput onBlur={handleBlurInput} />
				</div>
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
				<NodeViewCodeEditor nodeViewChildren={children} lang="typescript" onCodeChange={handleChartChange} />
			</TabsContent>
			<TabsContent value="preview" className="mt-2">
				<Mermaid chart={chart} />
			</TabsContent>
		</Tabs>
	);
}
