import type { BasicFormField } from "@keystatic/core";
import type { RawCode } from "codehike/code";
import { basicFormFieldWithSimpleReaderParse, FieldDataError } from "@/keystatic/libs/custom-field";
import { CodeEditor, CodeEditorWithLangSelector } from "./code-editor";

export const codeBlockField = ({
	label,
	validation,
}: {
	label: string;
	validation?: { isRequired: boolean };
}): BasicFormField<RawCode> => {
	return basicFormFieldWithSimpleReaderParse({
		label,
		Input(props) {
			return <CodeEditor {...props} />;
		},
		defaultValue() {
			return { value: "", lang: "typescript", meta: "" };
		},
		parse(value) {
			if (value === undefined) return { lang: "typescript", value: "", meta: "" };
			return value as RawCode;
		},
		validate(value) {
			if (validation?.isRequired && !value.value) {
				throw new FieldDataError("Must not be empty");
			}

			return value;
		},
		serialize(value) {
			return { value };
		},
	});
};

export const multiLangCodeBlockField = ({
	label,
	validation,
}: {
	label: string;
	validation?: { isRequired: boolean };
}): BasicFormField<RawCode> => {
	return basicFormFieldWithSimpleReaderParse({
		label,
		Input(props) {
			return <CodeEditorWithLangSelector {...props} />;
		},
		defaultValue() {
			return { value: "", lang: "typescript", meta: "" };
		},
		parse(value) {
			if (value === undefined) return { lang: "typescript", value: "", meta: "" };
			return value as RawCode;
		},
		validate(value) {
			if (validation?.isRequired && !value.value) {
				throw new FieldDataError("Must not be empty");
			}

			return value;
		},
		serialize(value) {
			return { value };
		},
	});
};
