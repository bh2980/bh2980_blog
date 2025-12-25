import { type FormFieldInputProps } from "@keystatic/core";
import { FieldPrimitive } from "@keystar/ui/field";

type ColorPickerFieldInputProps = FormFieldInputProps<string> & {
  label: string;
  description?: string;
};

export const ColorPickerFieldInput = (props: ColorPickerFieldInputProps) => {
  return (
    <FieldPrimitive label={props.label} description={props.description} isRequired>
      <input
        type="color"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoFocus={props.autoFocus}
      />
    </FieldPrimitive>
  );
};
