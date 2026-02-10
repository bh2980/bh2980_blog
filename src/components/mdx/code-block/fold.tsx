import { type ReactNode, useId } from "react";

export const fold = ({ children, open }: { children: ReactNode; open?: boolean }) => {
	const inputId = useId();

	return (
		<span className="inline-flex items-baseline gap-1 align-baseline">
			<input
				id={inputId}
				type="checkbox"
				className="peer sr-only"
				aria-label="Toggle folded inline code"
				defaultChecked={open}
			/>
			<label
				htmlFor={inputId}
				className="inline cursor-pointer select-none text-slate-500 hover:text-slate-700 peer-checked:hidden dark:text-slate-400 dark:hover:text-slate-200"
			>
				...
			</label>
			<label htmlFor={inputId} className="hidden cursor-pointer peer-checked:inline">
				<span className="inline">{children}</span>
			</label>
		</span>
	);
};
