// src/keystatic/fields/mdx-components/editor-pure-mdx-block.client.tsx
"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { CodeEditor } from "../shared/code-editor";

function stopBubble(e: any) {
	e.stopPropagation?.();
}

type Props = {
	value: { source?: string };
	onChange: (next: { source: string }) => void;
	onRemove: () => void;
	isSelected: boolean;
};

export function PureMdxBlockNodeView({ value, onChange, onRemove, isSelected }: Props) {
	const [local, setLocal] = React.useState(() => ({
		source: value.source ?? "",
	}));

	// undo/redo 등 외부 변경 동기화
	React.useEffect(() => {
		setLocal({ source: value.source ?? "" });
	}, [value.source]);

	// ✅ 트랜잭션은 여기서만
	const commit = React.useCallback(() => {
		onChange({ source: local.source });
	}, [onChange, local.source]);

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
				<div className="font-bold text-slate-500 text-xs uppercase">MDX</div>

				<Button
					type="button"
					variant="destructive"
					size="icon"
					onClick={onRemove}
					onMouseDown={stopBubble}
					data-ks-stop-event
					aria-label="Remove mdx block"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>

			{/* blur로도 저장되게(바깥 클릭/탭 이동 포함) */}
			<div onBlurCapture={commit}>
				<CodeEditor
					lang={"markdown"} // prism-markdown 로드돼 있으면 하이라이트됨
					code={local.source}
					onCodeChange={(next) => setLocal({ source: next })}
					onCommit={commit} // Cmd/Ctrl+Enter
				/>
			</div>

			<div className="text-slate-500 text-xs">저장은 포커스가 해제될 때만 반영됩니다.</div>
		</div>
	);
}
