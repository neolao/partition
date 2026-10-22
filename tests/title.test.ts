import { describe, expect, it } from "vitest";
import { APP_TITLE } from "../src/title";

describe("APP_TITLE", () => {
	it("vaut « Partition »", () => {
		expect(APP_TITLE).toBe("Partition");
	});
});
