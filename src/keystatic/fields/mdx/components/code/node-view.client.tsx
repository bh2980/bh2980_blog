"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/utils/cn";
import { CodeEditor } from "../shared/code-editor";
import { CodePreview } from "../shared/code-preview.client";
import { type CodeBlockValue, EDITOR_LANG_OPTION, type EditorLang } from "./constants";

function stopBubble(e: any) {
	e.stopPropagation?.();
}

type Props = {
	value: { codeblock: { lang?: string; meta?: string; value?: string } };
	onChange: (next: { codeblock: { lang: string; meta: string; value: string } }) => void;
	onRemove: () => void;
	isSelected: boolean;
};

export function CodeBlockNodeView({ value, onChange, onRemove, isSelected }: Props) {
	const [local, setLocal] = React.useState<CodeBlockValue>(() => ({
		lang: (value.codeblock.lang ?? "typescript") as EditorLang,
		meta: value.codeblock.meta ?? "",
		value: value.codeblock.value ?? "",
	}));

	// undo/redo 등 외부 변경 동기화
	React.useEffect(() => {
		setLocal({
			lang: (value.codeblock.lang ?? "typescript") as EditorLang,
			meta: value.codeblock.meta ?? "",
			value: value.codeblock.value ?? "",
		});
	}, [value.codeblock]);

	// ✅ 저장(트랜잭션)은 오직 여기서만 (타이핑 중 dispatch 금지)
	const commit = React.useCallback(() => {
		onChange({ codeblock: { lang: local.lang, meta: local.meta, value: local.value } });
	}, [onChange, local]);

	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4",
				isSelected && "outline-2 outline-slate-500 outline-offset-2",
			)}
			contentEditable={false}
			data-ks-stop-event
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Select value={local.lang} onValueChange={(lang) => setLocal((p) => ({ ...p, lang: lang as EditorLang }))}>
						<SelectTrigger className="w-[200px] bg-white" onMouseDown={stopBubble} onKeyDown={stopBubble}>
							<SelectValue placeholder="언어" />
						</SelectTrigger>
						<SelectContent>
							{EDITOR_LANG_OPTION.map((o) => (
								<SelectItem key={o.value} value={o.value}>
									{o.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Input
						className="w-[240px] bg-white"
						placeholder="ex) main.ts"
						value={local.meta}
						onChange={(e) => setLocal((p) => ({ ...p, meta: e.target.value }))}
						onMouseDown={stopBubble}
						onKeyDown={stopBubble}
						onBeforeInput={stopBubble}
					/>
				</div>

				<Button
					type="button"
					variant="destructive"
					size="icon"
					onClick={onRemove}
					onMouseDown={stop}
					data-ks-stop-event
					aria-label="Remove callout"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>

			<Tabs defaultValue="code" className="w-full" onMouseDown={stopBubble}>
				<TabsList className="w-fit">
					<TabsTrigger value="code">Code</TabsTrigger>
					<TabsTrigger value="preview">Preview</TabsTrigger>
				</TabsList>

				<TabsContent value="code" className="mt-2">
					<CodeEditor
						lang={local.lang}
						code={local.value}
						onCodeChange={(next) => setLocal((p) => ({ ...p, value: next }))}
						onCommit={commit} // Cmd/Ctrl+Enter용
					/>
					<div className="mt-2 text-slate-500 text-xs">저장은 포커스가 해제될 때만 반영됩니다.</div>
				</TabsContent>

				<TabsContent value="preview" className="mt-2">
					<CodePreview codeblock={{ value: local.value, lang: local.lang, meta: local.meta }} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
