"use client";

import { type HighlightedCode, highlight, Pre } from "codehike/code";
import { CheckCircle2Icon, CircleX, ListOrdered, Trash2 } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { lineNumbers } from "@/components/mdx/code-handler";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/utils/cn";
import type { NodeViewProps } from "./component";
import { EDITOR_LANG_OPTION, type EditorLang } from "./const";
import { escapeCodeHikeAnnotations } from "./libs";

export const CodeblockNodeView = ({ children, onRemove, onChange, value }: NodeViewProps) => {
	// WARNING: Keystatic raw text 미제공 → children 내부 DOM에서 innerText 추출(업데이트 시 깨질 수 있음).
	const textContent = (
		((children as ReactElement).props as { node: HTMLSpanElement }).node.childNodes[0] as HTMLParagraphElement
	).innerText;

	const title = value.meta.match(/title="(.+?)"/)?.[1];

	const titleInputRef = useRef<HTMLInputElement>(null);
	const [commited, setCommited] = useState(true);
	const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

	const handleLangChange = (lang: EditorLang) => onChange({ ...value, lang });
	const handleLineNumberChange = (useLineNumber: boolean) => onChange({ ...value, useLineNumber });

	const handleBlurTitle = useCallback(() => {
		if (!titleInputRef.current) {
			return;
		}

		const newTitle = titleInputRef.current.value.trim();

		const meta = value.meta.replace(/(title=")(.*?)(")/, `$1${newTitle}$3`);
		onChange({ ...value, meta });
		setCommited(true);
	}, [value, onChange]);

	useEffect(() => {
		const setCode = async (code: string) => {
			const h = await highlight({ value: code, lang: value.lang, meta: "" }, "dark-plus");
			setHighlighted(h);
		};

		setCode(escapeCodeHikeAnnotations(textContent));
	}, [textContent, value]);

	return (
		<div className="relative">
			<div className="flex justify-between">
				<div className="flex gap-2">
					<Select defaultValue={value.lang} onValueChange={handleLangChange}>
						<SelectTrigger size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{EDITOR_LANG_OPTION.map((lang) => (
								<SelectItem value={lang.value} key={lang.value}>
									{lang.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex items-center gap-1">
						<Input
							defaultValue={title}
							className="h-8"
							ref={titleInputRef}
							onBlur={handleBlurTitle}
							onChange={() => setCommited(false)}
							onKeyDownCapture={(e) => e.stopPropagation()}
							onKeyUpCapture={(e) => e.stopPropagation()}
							onBeforeInputCapture={(e) => e.stopPropagation()}
						/>
						{commited ? (
							<CheckCircle2Icon size={20} className="fill-green-600 stroke-white" />
						) : (
							<CircleX className="fill-red-600 stroke-white" size={20} />
						)}
					</div>
				</div>
				<ButtonGroup>
					<Toggle
						size={"sm"}
						variant={"outline"}
						pressed={value.useLineNumber}
						onPressedChange={handleLineNumberChange}
					>
						<ListOrdered />
					</Toggle>
					<Button variant={"destructive"} onClick={onRemove} size="icon-sm">
						<Trash2 />
					</Button>
				</ButtonGroup>
			</div>
			<pre
				className={cn(
					"absolute w-full bg-transparent! text-transparent! caret-white! [&_p]:m-0!",
					value.useLineNumber && "ml-[calc(2ch+0.5rem)]",
					"**:data-[component=u]:decoration-white! [&_s]:decoration-1! [&_s]:decoration-white!",
				)}
				style={highlighted?.style}
			>
				{children}
			</pre>
			{highlighted && (
				<Pre
					code={highlighted}
					style={{ ...highlighted.style }}
					className="pointer-events-none w-full select-none"
					handlers={value.useLineNumber ? [lineNumbers] : []}
				/>
			)}
		</div>
	);
};
