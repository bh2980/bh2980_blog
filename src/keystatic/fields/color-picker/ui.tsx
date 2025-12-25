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
					<div className="text-[var(--kui-color-foreground-critical)] text-2xl inline">*</div>
				</span>
				{!props.description && <span className="text-sm text-gray-500">{props.description}</span>}
				<input
					className="w-12 h-12"
					type="color"
					value={props.value}
					onChange={(e) => props.onChange(e.target.value)}
				/>
			</div>
		</label>
	);
};
