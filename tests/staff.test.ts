// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Score, type Settings } from "../src/score";
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

const textsOf = (el: HTMLElement) =>
	[...el.querySelectorAll("text.measure-status")].map((t) => ({
		status: t.getAttribute("data-status"),
		text: t.textContent,
	}));

describe("renderStaff : mesures", () => {
	it("dessine une portée par mesure et signale la mesure finale en cours", () => {
		const el = makeContainer();
		const score: Score = Array.from({ length: 5 }, () => quarter("c", 4));
		const { measures, centers } = renderStaff(el, 600, score, null);
		expect(measures).toHaveLength(2);
		expect(centers).toHaveLength(5);
		expect(el.querySelectorAll(".vf-stave")).toHaveLength(2);
		expect(textsOf(el)).toEqual([
			{ status: "in-progress", text: "… En cours : 1/4 sur 4/4" },
		]);
	});

	it("signale une mesure trop remplie, puis la dernière mesure en cours", () => {
		const el = makeContainer();
		const wholeNote = { kind: "rest", duration: "w" } as const;
		// 2 noires + ronde = 6/4 -> trop remplie ; puis 1 noire seule en fin.
		const over: Score = [quarter("c", 4), quarter("c", 4), wholeNote];
		renderStaff(el, 600, over, null);
		expect(textsOf(el)).toEqual([
			{ status: "overfull", text: "▲ Trop remplie : 3/2 sur 4/4" },
		]);
		const eighth = { kind: "rest", duration: "8" } as const;
		const incomplete: Score = [
			quarter("c", 4),
			{ kind: "rest", duration: "w" },
			eighth,
		];
		renderStaff(el, 600, incomplete, null);
		expect(textsOf(el).map((t) => t.status)).toEqual([
			"overfull",
			"in-progress",
		]);
	});

	it("ne met aucun texte sur une mesure complète ni sur une partition vide", () => {
		const el = makeContainer();
		const full: Score = Array.from({ length: 4 }, () => quarter("c", 4));
		renderStaff(el, 600, full, null);
		expect(textsOf(el)).toEqual([]);
		const { measures } = renderStaff(el, 600, [], null);
		expect(measures).toHaveLength(1);
		expect(textsOf(el)).toEqual([]);
	});

	it("range les éléments selon le chiffrage choisi : 3/4 complète la première mesure", () => {
		const el = makeContainer();
		const settings: Settings = {
			...DEFAULT_SETTINGS,
			time: { beats: 3, beatType: 4 },
		};
		const score: Score = [
			{ kind: "rest", duration: "h" },
			{ kind: "rest", duration: "q" },
			{ kind: "rest", duration: "q" },
		];
		const { measures } = renderStaff(el, 600, score, null, settings);
		expect(measures.map((m) => [m.start, m.end])).toEqual([
			[0, 2],
			[2, 3],
		]);
		expect(textsOf(el)).toEqual([
			{ status: "in-progress", text: "… En cours : 1/4 sur 3/4" },
		]);
	});

	it("élargit le dessin à toutes les mesures, sans que les éléments débordent", () => {
		const el = makeContainer();
		const score: Score = Array.from({ length: 40 }, () => quarter("c", 4));
		const { centers } = renderStaff(el, 300, score, null);
		const svgWidth = Number(el.querySelector("svg")?.getAttribute("width"));
		expect(svgWidth).toBeGreaterThan(300);
		expect(centers[39]).toBeLessThan(svgWidth);
		expect(centers[4]).toBeGreaterThan(centers[3]);
	});

	it("agrandit la hauteur du dessin pour loger les textes de statut", () => {
		const el = makeContainer();
		renderStaff(el, 600, [quarter("c", 4)], null);
		expect(
			Number(el.querySelector("svg")?.getAttribute("height")),
		).toBeGreaterThan(140);
	});
});

describe("renderStaff : réglages", () => {
	it("accepte clé de fa, clé d'ut, armure à 3 bémols et chiffrage 6/8", () => {
		for (const clef of ["bass", "alto"] as const) {
			const el = makeContainer();
			const settings: Settings = {
				clef,
				fifths: -3,
				time: { beats: 6, beatType: 8 },
			};
			const score: Score = [quarter("c", 3), { kind: "rest", duration: "q" }];
			const geometry = renderStaff(el, 600, score, 0, settings);
			expect(geometry.centers).toHaveLength(2);
			expect(el.querySelectorAll(".vf-stavenote")).toHaveLength(2);
			expect(geometry.measures[0].capacity).toBe(12);
			expect(textsOf(el)).toEqual([
				{ status: "in-progress", text: "… En cours : 1/2 sur 6/8" },
			]);
		}
	});

	it("dessine clé, armure et chiffrage seulement sur la première mesure", () => {
		const el = makeContainer();
		const settings: Settings = {
			clef: "treble",
			fifths: 2,
			time: { beats: 4, beatType: 4 },
		};
		const score: Score = Array.from({ length: 5 }, () => quarter("c", 4));
		renderStaff(el, 600, score, null, settings);
		expect(el.querySelectorAll(".vf-clef")).toHaveLength(1);
		expect(el.querySelectorAll(".vf-keysignature")).toHaveLength(1);
		expect(el.querySelectorAll(".vf-timesignature")).toHaveLength(1);
	});

	it("place les têtes de note selon la clé : do3 est sous la portée en clé de sol, dans une interligne en clé de fa", () => {
		const headY = (clef: "treble" | "bass") => {
			const el = makeContainer();
			renderStaff(el, 600, [quarter("c", 3)], null, {
				...DEFAULT_SETTINGS,
				clef,
			});
			return el.querySelector(".vf-notehead text")?.getAttribute("y");
		};
		// ligne du haut à 60, interligne 10 : do3 = 85 en clé de fa, 145 en clé de sol
		expect(headY("bass")).toBe("85");
		expect(headY("treble")).toBe("145");
	});

	it("rejette des réglages invalides", () => {
		const el = makeContainer();
		expect(() =>
			renderStaff(el, 600, [], null, { ...DEFAULT_SETTINGS, fifths: 9 }),
		).toThrow(RangeError);
	});
});
