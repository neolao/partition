// @vitest-environment jsdom
import { svg2pdf } from "svg2pdf.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fontDataUri from "../src/fonts/bravura-subset.ttf?inline";
import {
	buildPdf,
	GLYPH_FONT_FAMILY,
	paginateLines,
	splitIntoLines,
} from "../src/pdf";
import {
	CLEFS,
	type Clef,
	DEFAULT_SETTINGS,
	DURATIONS,
	type Duration,
	type Pitch,
	type Score,
	type ScoreElement,
	type Settings,
	splitMeasures,
	TIME_SIGNATURES,
} from "../src/score";
import { renderStaff } from "../src/staff";
import { readCmapCodePoints } from "./helpers/cmap";

// Numéro de page courant du PDF au moment de chaque appel à svg2pdf.
const pagesAtDraw = vi.hoisted(() => [] as number[]);

vi.mock("svg2pdf.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("svg2pdf.js")>();
	return {
		...actual,
		svg2pdf: vi.fn((element, pdf, options) => {
			pagesAtDraw.push(pdf.getCurrentPageInfo().pageNumber);
			return actual.svg2pdf(element, pdf, options);
		}),
	};
});

const note = (duration: Duration): ScoreElement => ({
	kind: "note",
	pitch: { step: "g", octave: 4 },
	duration,
});
const repeat = (duration: Duration, count: number): Score =>
	Array.from({ length: count }, () => note(duration));
const measureCount = (score: Score) =>
	splitMeasures(score, DEFAULT_SETTINGS.time).length;

describe("paginateLines", () => {
	const layout = { pageHeight: 800, margin: 50, lineHeight: 100 };

	it("place les lignes les unes sous les autres à partir de la marge haute", () => {
		expect(paginateLines(3, layout)).toEqual([
			{ page: 0, y: 50 },
			{ page: 0, y: 150 },
			{ page: 0, y: 250 },
		]);
	});

	it("passe à la page suivante quand la ligne dépasse la marge basse", () => {
		const slots = paginateLines(8, layout);
		// Hauteur utile 700 : 7 lignes par page.
		expect(slots.filter((s) => s.page === 0)).toHaveLength(7);
		expect(slots[7]).toEqual({ page: 1, y: 50 });
	});

	it("remplit exactement une page sans en ouvrir une autre", () => {
		const slots = paginateLines(7, layout);
		expect(slots[6]).toEqual({ page: 0, y: 650 });
	});

	it("ne renvoie aucun emplacement pour zéro ligne", () => {
		expect(paginateLines(0, layout)).toEqual([]);
	});

	it("refuse une ligne plus haute que la zone utile", () => {
		expect(() => paginateLines(1, { ...layout, lineHeight: 701 })).toThrow(
			RangeError,
		);
	});
});

describe("splitIntoLines", () => {
	it("garde une partition courte sur une seule ligne", () => {
		const score = repeat("q", 8);
		expect(splitIntoLines(score, DEFAULT_SETTINGS, 700)).toEqual([score]);
	});

	it("répartit une partition longue en plusieurs lignes sans couper de mesure", () => {
		const score = repeat("q", 80);
		const lines = splitIntoLines(score, DEFAULT_SETTINGS, 500);
		expect(lines.length).toBeGreaterThan(2);
		expect(lines.flat()).toEqual(score);
		for (const line of lines) {
			expect(line.length % 4).toBe(0);
		}
		expect(lines.reduce((sum, line) => sum + measureCount(line), 0)).toBe(
			measureCount(score),
		);
	});

	it("laisse seule sur sa ligne une mesure plus large que la largeur cible", () => {
		const wide = repeat("16", 16);
		const narrow = repeat("q", 4);
		const lines = splitIntoLines(
			[...wide, ...narrow, ...wide],
			DEFAULT_SETTINGS,
			400,
		);
		expect(lines.map((line) => line.length)).toEqual([16, 4, 16]);
	});

	it("garde la dernière mesure incomplète sur la dernière ligne", () => {
		const score = [...repeat("q", 8), note("q")];
		const lines = splitIntoLines(score, DEFAULT_SETTINGS, 700);
		expect(lines.flat()).toEqual(score);
	});

	it("renvoie une ligne vide pour une partition vide", () => {
		expect(splitIntoLines([], DEFAULT_SETTINGS, 700)).toEqual([[]]);
	});
});

describe("buildPdf", () => {
	// jsdom ne mesure pas les textes SVG : svg2pdf en a besoin pour les lire.
	beforeAll(() => {
		Object.defineProperty(SVGElement.prototype, "getBBox", {
			configurable: true,
			value: () => ({ x: 0, y: 0, width: 10, height: 10 }),
		});
	});

	beforeEach(() => {
		vi.clearAllMocks();
		pagesAtDraw.length = 0;
	});

	const pageCount = (text: string) =>
		(text.match(/\/Type\s*\/Page\b/g) ?? []).length;

	it("produit un PDF valide pour une courte partition", async () => {
		const blob = await buildPdf(
			[note("q"), { kind: "rest", duration: "h" }],
			DEFAULT_SETTINGS,
		);
		expect(blob.type).toBe("application/pdf");
		const text = await blob.text();
		expect(text.startsWith("%PDF")).toBe(true);
		expect(pageCount(text)).toBe(1);
	});

	// Tailles des opérateurs « /F<n> <taille> Tf » qui utilisent la police dont le /BaseFont est `family`.
	// (jsPDF écrit un /BaseFont pour toute police enregistrée, même inutilisée : seul un Tf prouve l'usage.)
	const sizesDrawnWith = (pdfText: string, family: string): number[] => {
		const resources = [...pdfText.matchAll(/\/F(\d+) (\d+) 0 R/g)];
		const ids = resources
			.filter(([, , object]) =>
				new RegExp(
					`\\n${object} 0 obj[\\s\\S]*?/BaseFont /${family}\\s[\\s\\S]*?endobj`,
				).test(pdfText),
			)
			.map(([, id]) => id);
		return [...pdfText.matchAll(/\/F(\d+)\s+([\d.]+)\s+Tf/g)]
			.filter(([, id]) => ids.includes(id))
			.map(([, , size]) => Number(size));
	};

	it("dessine les glyphes avec la police Bravura embarquée, en taille non nulle", async () => {
		const text = await (await buildPdf([note("q")], DEFAULT_SETTINGS)).text();
		const sizes = sizesDrawnWith(text, GLYPH_FONT_FAMILY);
		expect(sizes.length).toBeGreaterThan(0);
		expect(sizes.every((size) => size > 0)).toBe(true);
	});

	it("convertit en pixels les tailles en points des glyphes avant svg2pdf (30 pt vaut 40 px)", async () => {
		const raw = document.createElement("div");
		renderStaff(raw, 700, [note("q")], null, DEFAULT_SETTINGS);
		const rawSizes = [...raw.querySelectorAll("text[font-size]")].map((t) =>
			t.getAttribute("font-size"),
		);
		// Hypothèse de départ : VexFlow écrit les glyphes en 30pt.
		expect(rawSizes).toContain("30pt");

		await buildPdf([note("q")], DEFAULT_SETTINGS);
		const [[element]] = vi.mocked(svg2pdf).mock.calls;
		const sizes = [
			...(element as Element).querySelectorAll("text[font-size]"),
		].map((t) => t.getAttribute("font-size"));
		expect(sizes.filter((size) => size === "40")).toHaveLength(
			rawSizes.filter((size) => size === "30pt").length,
		);
		expect(sizes.some((size) => size?.endsWith("pt"))).toBe(false);
	});

	it("fournit à svg2pdf un SVG dont la famille est celle de la police enregistrée dans le PDF", async () => {
		await buildPdf([note("q")], DEFAULT_SETTINGS);
		const [[element]] = vi.mocked(svg2pdf).mock.calls;
		const families = (element as Element)
			.getAttribute("font-family")
			?.split(",")
			.map((family) => family.trim());
		expect(families?.[0]).toBe(GLYPH_FONT_FAMILY);
	});

	it("produit plusieurs pages pour une partition longue", async () => {
		const blob = await buildPdf(repeat("q", 160), DEFAULT_SETTINGS);
		expect(pageCount(await blob.text())).toBeGreaterThan(1);
	}, 20000);

	it("retire le dessin temporaire du document", async () => {
		await buildPdf(repeat("q", 8), DEFAULT_SETTINGS);
		expect(document.body.querySelector("svg")).toBeNull();
		expect(document.body.children).toHaveLength(0);
	});

	it("refuse une partition vide", async () => {
		await expect(buildPdf([], DEFAULT_SETTINGS)).rejects.toThrow(
			"Partition vide",
		);
	});

	it("refuse des réglages invalides", async () => {
		await expect(
			buildPdf([note("q")], { ...DEFAULT_SETTINGS, fifths: 99 }),
		).rejects.toThrow(RangeError);
	});

	it("retire le dessin temporaire et propage l'erreur quand la génération échoue en cours de route", async () => {
		vi.mocked(svg2pdf).mockRejectedValueOnce(new Error("svg2pdf a échoué"));
		await expect(buildPdf(repeat("q", 8), DEFAULT_SETTINGS)).rejects.toThrow(
			"svg2pdf a échoué",
		);
		expect(svg2pdf).toHaveBeenCalled();
		expect(document.body.children).toHaveLength(0);
	});

	it("écrit les libellés de statut en Helvetica, sans caractère hors WinAnsi", async () => {
		// Une mesure trop remplie (5/4), puis une mesure en cours (1/4).
		const score = [note("q"), note("q"), note("q"), note("h"), note("q")];
		await buildPdf(score, DEFAULT_SETTINGS);
		const labels = vi
			.mocked(svg2pdf)
			.mock.calls.flatMap(([element]) => [
				...(element as Element).querySelectorAll("text.measure-status"),
			]);
		expect(labels).toHaveLength(2);
		for (const label of labels) {
			expect(label.getAttribute("font-family")).toBe("helvetica");
			expect(label.textContent).toMatch(/^[\x20-\x7E\xA0-\xFF]+$/);
		}
	});

	describe("placement sur la page", () => {
		const RIGHT = 595.28 - 40;
		const BOTTOM = 841.89 - 40;
		const placements = () =>
			vi.mocked(svg2pdf).mock.calls.map(([element, , options]) => ({
				nativeWidth: Number((element as Element).getAttribute("width")),
				x: options?.x ?? Number.NaN,
				y: options?.y ?? Number.NaN,
				width: options?.width ?? Number.NaN,
				height: options?.height ?? Number.NaN,
			}));

		it("garde chaque ligne dans les marges et empile les lignes d'une page vers le bas", async () => {
			await buildPdf(repeat("q", 160), DEFAULT_SETTINGS);
			const all = placements();
			expect(all.length).toBeGreaterThan(2);
			for (const p of all) {
				expect(p.x).toBeGreaterThanOrEqual(40);
				expect(p.y).toBeGreaterThanOrEqual(40);
				expect(p.x + p.width).toBeLessThanOrEqual(RIGHT + 1e-6);
				expect(p.y + p.height).toBeLessThanOrEqual(BOTTOM + 1e-6);
			}
			// Sur une même page y croît ; un retour à la marge haute ouvre la page suivante.
			let newPages = 0;
			all.slice(1).forEach((p, i) => {
				if (p.y > all[i].y) {
					return;
				}
				expect(p.y).toBe(40);
				newPages++;
			});
			expect(newPages).toBeGreaterThan(0);
			expect(all.filter((p) => p.y > 40).length).toBeGreaterThan(0);
		}, 20000);

		it("dessine chaque ligne sur la page prévue par paginateLines", async () => {
			await buildPdf(repeat("q", 160), DEFAULT_SETTINGS);
			const all = placements();
			const expected = paginateLines(all.length, {
				pageHeight: 841.89,
				margin: 40,
				lineHeight: Math.max(...all.map((p) => p.height)),
			});
			expect(expected[expected.length - 1].page).toBeGreaterThan(0);
			expect(pagesAtDraw).toEqual(expected.map((slot) => slot.page + 1));
			expect(all.map((p) => p.y)).toEqual(expected.map((slot) => slot.y));
		}, 20000);

		it("réduit pour rester dans les marges une mesure seule plus large que la cible", async () => {
			// Une seule mesure de seize doubles croches, plus large que les 700 px visés.
			await buildPdf(repeat("16", 16), DEFAULT_SETTINGS);
			const all = placements();
			expect(all).toHaveLength(1);
			expect(all[0].nativeWidth).toBeGreaterThan(RIGHT - 40);
			expect(all[0].x + all[0].width).toBeLessThanOrEqual(RIGHT + 1e-6);
			expect(all[0].y + all[0].height).toBeLessThanOrEqual(BOTTOM + 1e-6);
		});
	});
});

describe("police embarquée", () => {
	const covered = readCmapCodePoints(
		Uint8Array.from(
			atob(fontDataUri.slice(fontDataUri.indexOf(",") + 1)),
			(c) => c.charCodeAt(0),
		),
	);
	const glyphsOf = (score: Score, settings: Settings): number[] => {
		const container = document.createElement("div");
		renderStaff(container, 700, score, null, settings);
		return [...container.querySelectorAll("text:not(.measure-status)")]
			.flatMap((text) => [...(text.textContent ?? "")])
			.map((char) => char.codePointAt(0) as number);
	};
	const missing = (codePoints: number[]) =>
		[...new Set(codePoints.filter((code) => !covered.has(code)))].map(
			(code) => `U+${code.toString(16).toUpperCase()}`,
		);

	it("contient les glyphes de chaque durée, note et silence", () => {
		const elements = DURATIONS.flatMap((duration) => [
			note(duration),
			{ kind: "rest", duration } as const,
		]);
		const glyphs = glyphsOf(elements, DEFAULT_SETTINGS);
		expect(glyphs.length).toBeGreaterThan(0);
		expect(missing(glyphs)).toEqual([]);
	});

	it("contient les fanions des croches et doubles croches, hampe en haut et en bas, pour chaque clé", () => {
		// Une note sous et une note au-dessus de la ligne du milieu de la clé (hampe en haut / en bas).
		const pitches: Record<Clef, { low: Pitch; high: Pitch }> = {
			treble: {
				low: { step: "g", octave: 4 },
				high: { step: "b", octave: 5 },
			},
			bass: { low: { step: "b", octave: 2 }, high: { step: "d", octave: 4 } },
			alto: { low: { step: "e", octave: 3 }, high: { step: "c", octave: 5 } },
		};
		for (const clef of CLEFS) {
			const elements = (["8", "16"] as const).flatMap((duration) =>
				[pitches[clef].low, pitches[clef].high].map(
					(pitch) => ({ kind: "note", pitch, duration }) as const,
				),
			);
			const glyphs = glyphsOf(elements, { ...DEFAULT_SETTINGS, clef });
			// Les fanions des deux durées sont bien dessinés (hampe en haut : U+E240, U+E242).
			expect(glyphs, clef).toEqual(expect.arrayContaining([0xe240, 0xe242]));
			expect(missing(glyphs)).toEqual([]);
		}
	});

	it("contient aussi les fanions hampe en bas (U+E241, U+E243), au cas où VexFlow les choisirait", () => {
		expect(missing([0xe241, 0xe243])).toEqual([]);
	});

	it("contient les glyphes de chaque clé", () => {
		for (const clef of CLEFS) {
			expect(
				missing(glyphsOf([note("q")], { ...DEFAULT_SETTINGS, clef })),
			).toEqual([]);
		}
	});

	it("contient les glyphes des altérations de chaque armure de -7 à 7", () => {
		for (let fifths = -7; fifths <= 7; fifths++) {
			expect(
				missing(glyphsOf([note("q")], { ...DEFAULT_SETTINGS, fifths })),
			).toEqual([]);
		}
	});

	it("contient les glyphes de chaque chiffrage", () => {
		for (const time of TIME_SIGNATURES) {
			expect(
				missing(glyphsOf([note("q")], { ...DEFAULT_SETTINGS, time })),
			).toEqual([]);
		}
	});
});
