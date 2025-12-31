import type { FormFieldInputProps } from "@keystatic/core";

type ColorPickerFieldInputProps = FormFieldInputProps<string> & {
	label: string;
	description?: string;
};

export const ColorPickerFieldInput = (props: ColorPickerFieldInputProps) => {
	return (
		<label>
			<div className="flex flex-col gap-1">
				<span>
					{props.label}
					<div className="inline text-2xl text-[var(--kui-color-foreground-critical)]">*</div>
				</span>
				{!props.description && <span className="text-slate-500 text-sm">{props.description}</span>}
				<input
					className="h-12 w-12"
					type="color"
					value={props.value}
					onChange={(e) => props.onChange(e.target.value)}
				/>
			</div>
		</label>
	);
};
