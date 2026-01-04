// src/keystatic/fields/mdx-components/editor-mermaid-block.client.tsx
"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";
import { Mermaid } from "@/components/mermaid.client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/utils/cn";
import { CodeEditor } from "../shared/code-editor";

function stopBubble(e: any) {
	e.stopPropagation?.();
}

type Props = {
	value: { chart?: string };
	onChange: (next: { chart: string }) => void;
	onRemove: () => void;
	isSelected: boolean;
};

export function MermaidBlockNodeView({ value, onChange, onRemove, isSelected }: Props) {
	const [local, setLocal] = React.useState(() => ({
		chart: value.chart ?? "",
	}));

	// undo/redo 등 외부 변경 동기화
	React.useEffect(() => {
		setLocal({ chart: value.chart ?? "" });
	}, [value.chart]);

	// ✅ 트랜잭션은 여기서만
	const commit = React.useCallback(() => {
		onChange({ chart: local.chart });
	}, [onChange, local.chart]);

	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4",
				isSelected && "outline-2 outline-slate-500 outline-offset-2",
			)}
			data-ks-stop-event
		>
			{/* Toolbar */}
			<div className="flex items-center justify-between gap-2">
				<div className="font-bold text-slate-500 text-xs uppercase">MERMAID</div>

				<Button
					type="button"
					variant="destructive"
					size="icon"
					onClick={onRemove}
					onMouseDown={stopBubble}
					data-ks-stop-event
					aria-label="Remove mermaid block"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>

			<Tabs defaultValue="code" className="w-full">
				<TabsList className="w-fit">
					<TabsTrigger value="code">Code</TabsTrigger>
					<TabsTrigger value="preview">Preview</TabsTrigger>
				</TabsList>

				<TabsContent value="code" className="mt-2">
					{/* blur 캡처로도 커밋되게(탭 전환/바깥 클릭 포함) */}
					<div onBlurCapture={commit}>
						<CodeEditor
							lang={"mermaid"}
							code={local.chart}
							onCodeChange={(next) => setLocal({ chart: next })}
							onCommit={commit} // Cmd/Ctrl+Enter용
						/>
					</div>
					<div className="mt-2 text-slate-500 text-xs">저장은 포커스가 해제될 때만 반영됩니다.</div>
				</TabsContent>

				<TabsContent value="preview" className="mt-2">
					<div className="rounded-md border bg-white p-3">
						{local.chart ? (
							<Mermaid chart={local.chart} />
						) : (
							<div className="text-slate-400 text-sm">코드를 입력하면 미리보기가 생성됩니다.</div>
						)}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
