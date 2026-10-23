// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Score } from "../src/score";
import { MIN_STAFF_WIDTH, renderEmptyStaff, renderStaff } from "../src/staff";

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

const quarter = (step: "c" | "e" | "g", octave: number) =>
	({ kind: "note", pitch: { step, octave }, duration: "q" }) as const;
const halfRest = { kind: "rest", duration: "h" } as const;

describe("renderStaff", () => {
	it("dessine un élément VexFlow par note ou silence", () => {
		const el = makeContainer();
		const score: Score = [quarter("c", 4), halfRest, quarter("g", 4)];
		renderStaff(el, 600, score, null);
		expect(el.querySelectorAll(".vf-stavenote")).toHaveLength(3);
	});

	it("renvoie la géométrie de la portée : ligne du haut à 60 et interligne de 10", () => {
		const el = makeContainer();
		const geometry = renderStaff(el, 600, [], null);
		const firstLine = el.querySelector(".vf-stave path");
		expect(firstLine?.getAttribute("d")).toBe("M10 60.5L590 60.5");
		expect(geometry.topLineY).toBe(60);
		expect(geometry.lineSpacing).toBe(10);
		expect(geometry.centers).toEqual([]);
	});

	it("renvoie une abscisse par élément, dans l'ordre croissant et à l'intérieur du dessin", () => {
		const el = makeContainer();
		const score: Score = [quarter("c", 4), halfRest, quarter("g", 4)];
		const { centers } = renderStaff(el, 600, score, null);
		expect(centers).toHaveLength(3);
		expect(centers[0]).toBeLessThan(centers[1]);
		expect(centers[1]).toBeLessThan(centers[2]);
		expect(centers[2]).toBeLessThan(600);
	});

	it("met en évidence l'élément sélectionné par une couleur différente et un trait plus épais", () => {
		const el = makeContainer();
		renderStaff(el, 600, [quarter("c", 4), quarter("e", 4)], 1);
		const [plain, selected] = el.querySelectorAll(".vf-stavenote");
		expect(plain.getAttribute("stroke-width")).toBeNull();
		expect(plain.getAttribute("fill")).toBeNull();
		expect(
			Number(selected.getAttribute("stroke-width")),
		).toBeGreaterThanOrEqual(2);
		expect(selected.getAttribute("fill")).not.toBeNull();
	});

	it("ajoute un repère non coloré sous l'élément sélectionné, centré sur lui, et seulement pour lui", () => {
		const el = makeContainer();
		const score: Score = [quarter("c", 4), halfRest];
		const { centers } = renderStaff(el, 600, score, 1);
		const marks = el.querySelectorAll("rect.selection-mark");
		expect(marks).toHaveLength(1);
		const mark = marks[0];
		const x = Number(mark.getAttribute("x"));
		const width = Number(mark.getAttribute("width"));
		expect(x + width / 2).toBeCloseTo(centers[1], 5);
		// sous la dernière ligne de la portée (y = 100)
		expect(Number(mark.getAttribute("y"))).toBeGreaterThan(100);
	});

	it("retire le repère quand plus rien n'est sélectionné", () => {
		const el = makeContainer();
		const score: Score = [quarter("c", 4)];
		renderStaff(el, 600, score, 0);
		renderStaff(el, 600, score, null);
		expect(el.querySelectorAll(".selection-mark")).toHaveLength(0);
	});

	it("n'applique aucune mise en évidence sans sélection", () => {
		const el = makeContainer();
		renderStaff(el, 600, [quarter("c", 4)], null);
		expect(
			el.querySelector(".vf-stavenote")?.getAttribute("stroke-width"),
		).toBeNull();
	});

	it("élargit le dessin pour que les notes ne débordent jamais", () => {
		const el = makeContainer();
		const score: Score = Array.from({ length: 40 }, () => quarter("c", 4));
		const { centers } = renderStaff(el, 300, score, null);
		const svgWidth = Number(el.querySelector("svg")?.getAttribute("width"));
		expect(svgWidth).toBeGreaterThan(300);
		expect(centers[39]).toBeLessThan(svgWidth);
	});

	it("rejette une sélection hors de la partition", () => {
		const el = makeContainer();
		expect(() => renderStaff(el, 600, [quarter("c", 4)], 1)).toThrow(
			RangeError,
		);
	});

	it("rejette une largeur non numérique", () => {
		const el = makeContainer();
		expect(() => renderStaff(el, Number.NaN, [], null)).toThrow(RangeError);
	});
});
