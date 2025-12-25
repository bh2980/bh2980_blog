import type { BasicFormField } from "@keystatic/core";
import { basicFormFieldWithSimpleReaderParse, FieldDataError } from "@/keystatic/utils/custom-field";
import { ColorPickerFieldInput } from "./ui";

export const colorPicker = ({
	label,
	defaultValue,
	description,
	validation,
}: {
	label: string;
	defaultValue: string;
	description?: string;
	validation?: { isRequired: boolean };
}): BasicFormField<string> => {
	return basicFormFieldWithSimpleReaderParse({
		label,
		Input(props) {
			return <ColorPickerFieldInput {...props} label={label} description={description} />;
		},
		defaultValue() {
			return defaultValue;
		},
		parse(value) {
			if (value === undefined) return defaultValue;
			if (typeof value !== "string") {
				throw new FieldDataError("Must be a string");
			}
			return value;
		},
		validate(value) {
			if (validation?.isRequired && !value) {
				throw new FieldDataError("Must not be empty");
			}

			return value;
		},
		serialize(value) {
			return { value };
		},
	});
};
