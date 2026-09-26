import { describe, expect, it } from "vitest";
import { getSerializableExtensionsSchema } from "../extensions-example";

describe("M5-ED-1 Field & Block Extensions Contract (F07)", () => {
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
