"use client";

import { CheckCircle2Icon, CircleX } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export const BlurChangeInput = ({
	defaultValue,
	onBlur,
}: {
	defaultValue?: string;
	onBlur?: (value: string) => void;
}) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [committed, setCommitted] = useState(true);

	const handleBlurInput = useCallback(() => {
		if (!inputRef.current) {
			return;
		}

		const newValue = inputRef.current.value.trim();

		onBlur?.(newValue);
		setCommitted(true);
	}, [onBlur]);

	return (
		<div className="flex items-center gap-1">
			<Input
				defaultValue={defaultValue}
				className="h-8"
				ref={inputRef}
				onBlur={handleBlurInput}
				onChange={() => setCommitted(false)}
				onKeyDownCapture={(e) => e.stopPropagation()}
				onKeyUpCapture={(e) => e.stopPropagation()}
				onBeforeInputCapture={(e) => e.stopPropagation()}
			/>
			{committed ? (
				<CheckCircle2Icon size={20} className="fill-green-600 stroke-white" />
			) : (
				<CircleX className="fill-red-600 stroke-white" size={20} />
			)}
		</div>
	);
};
