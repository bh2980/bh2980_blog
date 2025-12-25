import { FieldPrimitive } from "@keystar/ui/field";
import type { FormFieldInputProps } from "@keystatic/core";

type ColorPickerFieldInputProps = FormFieldInputProps<string> & {
	label: string;
	description?: string;
};

export const ColorPickerFieldInput = (props: ColorPickerFieldInputProps) => {
	return (
		<FieldPrimitive label={props.label} description={props.description} isRequired>
			<input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
		</FieldPrimitive>
	);
};
