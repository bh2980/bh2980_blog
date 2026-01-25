"use client";

import { useEffect, useRef } from "react";
import type { TabNodeViewProps } from "./component";

export const TabNodeView = (props: TabNodeViewProps) => {
	const { value, onChange, children } = props;
	const composingRef = useRef(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const el = inputRef.current;
		if (!el) return;
		if (document.activeElement === el) return;
		const next = value.label ?? "";
		if (el.value !== next) el.value = next;
	}, [value.label]);

	return (
		<div className="rounded-md border">
			<div contentEditable={false} className="flex items-center gap-2 border-b bg-muted/50 px-2 py-1">
				<input
					ref={inputRef}
					defaultValue={value.label ?? ""}
					placeholder="탭 이름"
					className="h-7 w-full rounded-sm bg-background px-2 text-sm outline-none ring-1 ring-transparent focus:ring-ring"
					onPointerDownCapture={(e) => e.stopPropagation()}
					onMouseDownCapture={(e) => e.stopPropagation()}
					onKeyDownCapture={(e) => e.stopPropagation()}
					onFocusCapture={(e) => e.stopPropagation()}
					onCompositionStart={() => {
						composingRef.current = true;
					}}
					onCompositionEnd={() => {
						composingRef.current = false;
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							(e.currentTarget as HTMLInputElement).blur();
						}
						if (e.key === "Escape") {
							e.preventDefault();
							const prev = value.label ?? "";
							if (inputRef.current) inputRef.current.value = prev;
							(e.currentTarget as HTMLInputElement).blur();
						}
					}}
					onBlur={(e) => {
						if (composingRef.current) return;

						const raw = e.currentTarget.value.trim();
						const safe = raw.length ? raw : "Tab";
						if (e.currentTarget.value !== safe) e.currentTarget.value = safe;

						if (safe !== (value.label ?? "")) {
							onChange({ label: safe });
						}
					}}
				/>
			</div>

			<div className="p-2">{children}</div>
		</div>
	);
};
