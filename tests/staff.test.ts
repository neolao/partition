// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MIN_STAFF_WIDTH, renderEmptyStaff } from "../src/staff";

function makeContainer(): HTMLElement {
	const el = document.createElement("div");
	document.body.append(el);
	return el;
}

describe("renderEmptyStaff", () => {
	it("dessine une portée SVG avec ses cinq lignes", () => {
		const el = makeContainer();
		renderEmptyStaff(el, 600);
		expect(el.querySelectorAll("svg")).toHaveLength(1);
		expect(el.querySelectorAll("svg path").length).toBeGreaterThanOrEqual(5);
	});

	it("adapte la largeur du dessin à la largeur demandée", () => {
		const el = makeContainer();
		renderEmptyStaff(el, 900);
		const svg = el.querySelector("svg");
		expect(svg?.getAttribute("width")).toBe("900");
	});

	it("remplace le dessin précédent au lieu de l'empiler", () => {
		const el = makeContainer();
		renderEmptyStaff(el, 600);
		renderEmptyStaff(el, 400);
		expect(el.querySelectorAll("svg")).toHaveLength(1);
		expect(el.querySelector("svg")?.getAttribute("width")).toBe("400");
	});

	it("applique une largeur minimale quand la place est trop étroite", () => {
		const el = makeContainer();
		renderEmptyStaff(el, 10);
		expect(el.querySelector("svg")?.getAttribute("width")).toBe(
			String(MIN_STAFF_WIDTH),
		);
	});

	it("rejette une largeur non numérique", () => {
		const el = makeContainer();
		expect(() => renderEmptyStaff(el, Number.NaN)).toThrow(RangeError);
	});
});
