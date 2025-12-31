import { fields as keystaticFields } from "@keystatic/core";
import { colorPicker } from "./color-picker";
import { mdx } from "./mdx";
import { slug } from "./slug";

export const fields = {
	...keystaticFields,
	slug,
	mdx,
	colorPicker,
};
