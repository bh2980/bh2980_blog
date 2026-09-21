import { describe, expect, it } from "vitest";
import {
	calloutBlockExample,
	colorFieldExample,
	getSerializableExtensionsSchema,
	linkObjectFieldExample,
	slugHelperExample,
} from "../extensions-example";

describe("M5-ED-1 Field & Block Extensions Contract (F07)", () => {
	it("validates color field extension format", () => {
		expect(colorFieldExample.type).toBe("custom:color");
		expect(colorFieldExample.validate?.("#ff00aa")).toBe(true);
		expect(colorFieldExample.validate?.("invalid-color")).toBe(false);
	});

	it("validates slug helper pattern", () => {
		expect(slugHelperExample.targetField).toBe("slug");
		expect(slugHelperExample.onAction?.("Hello World 123")).toBe("hello-world-123");
	});

	it("validates link object field and callout block definitions", () => {
		expect(linkObjectFieldExample.properties.url.required).toBe(true);
		expect(calloutBlockExample.component).toBe("Callout");
		expect(calloutBlockExample.hasChildren).toBe(true);
	});

	it("ensures getSerializableExtensionsSchema contains NO functions/React components and serializes cleanly to JSON", () => {
		const schema = getSerializableExtensionsSchema();
		const jsonString = JSON.stringify(schema);
		const roundtrip = JSON.parse(jsonString);

		expect(roundtrip).toEqual(schema);

		// Deep check that no value is a function
		const checkNoFunctions = (obj: any) => {
			for (const key of Object.keys(obj)) {
				expect(typeof obj[key]).not.toBe("function");
				if (typeof obj[key] === "object" && obj[key] !== null) {
					checkNoFunctions(obj[key]);
				}
			}
		};
		checkNoFunctions(schema);
	});
});
