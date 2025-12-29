import type { BasicFormField } from "@keystatic/core";
import type { RawCode } from "codehike/code";
import { basicFormFieldWithSimpleReaderParse, FieldDataError } from "@/keystatic/libs/custom-field";
import { CodeInput } from "./ui";

export const codePreview = ({
	label,
	validation,
}: {
	label: string;
	validation?: { isRequired: boolean };
}): BasicFormField<RawCode> => {
	return basicFormFieldWithSimpleReaderParse({
		label,
		Input(props) {
			return <CodeInput {...props} />;
		},
		defaultValue() {
			return { value: "", lang: "ts", meta: "" };
		},
		parse(value) {
			if (value === undefined) return { lang: "ts", value: "", meta: "" };
			return value as RawCode;
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
