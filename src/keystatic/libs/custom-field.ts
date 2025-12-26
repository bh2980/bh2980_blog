import type { BasicFormField, FormFieldInputProps, FormFieldStoredValue } from "@keystatic/core";
import type { ReactElement } from "react";

// https://github.com/Thinkmill/keystatic/blob/main/packages/keystatic/src/form/fields/error.ts

export class FieldDataError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FieldDataError";
	}
}

// https://github.com/Thinkmill/keystatic/blob/main/packages/keystatic/src/form/fields/utils.tsx

export function basicFormFieldWithSimpleReaderParse<
	// biome-ignore lint/complexity/noBannedTypes: follow the original code type
	ParsedValue extends {} | null,
	ValidatedValue extends ParsedValue,
>(config: {
	Input(props: FormFieldInputProps<ParsedValue>): ReactElement | null;
	defaultValue(): ParsedValue;
	parse(value: FormFieldStoredValue): ParsedValue;
	/**
	 * If undefined is returned, the field will generally not be written,
	 * except in array fields where it will be stored as null
	 */
	serialize(value: ParsedValue): { value: FormFieldStoredValue };
	validate(value: ParsedValue): ValidatedValue;
	label: string;
}): BasicFormField<ParsedValue, ValidatedValue, ValidatedValue> {
	return {
		kind: "form",
		Input: config.Input,
		defaultValue: config.defaultValue,
		parse: config.parse,
		serialize: config.serialize,
		validate: config.validate,
		reader: {
			parse(value) {
				return config.validate(config.parse(value));
			},
		},
		label: config.label,
	};
}
