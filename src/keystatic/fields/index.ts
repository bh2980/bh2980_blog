import { fields as keystaticFields } from "@keystatic/core";
import { colorPicker } from "./color-picker";
import { markdoc } from "./markdoc";
import { slug } from "./slug";

export const fields = {
	...keystaticFields,
	slug,
	markdoc,
	colorPicker,
};
