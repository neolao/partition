// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fromMusicXml, toMusicXml } from "../src/musicxml";
import type { Score } from "../src/score";

function parse(xml: string): Document {
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	expect(doc.querySelector("parsererror")).toBeNull();
	return doc;
}

const noteSummary = (doc: Document) =>
	[...doc.querySelectorAll("measure > note")].map((n) => ({
		rest: n.querySelector("rest") !== null,
		step: n.querySelector("pitch > step")?.textContent,
		octave: n.querySelector("pitch > octave")?.textContent,
		duration: n.querySelector("duration")?.textContent,
		type: n.querySelector("type")?.textContent,
		order: [...n.children].map((c) => c.tagName),
	}));

describe("toMusicXml", () => {
	it("écrit un document score-partwise avec notes, silences et durées", () => {
		const score: Score = [
			{ kind: "note", pitch: { step: "c", octave: 4 }, duration: "q" },
			{ kind: "rest", duration: "h" },
			{ kind: "note", pitch: { step: "g", octave: 5 }, duration: "8" },
		];
		const xml = toMusicXml(score);
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"')).toBe(true);
		expect(xml).toContain("<!DOCTYPE score-partwise");
		const doc = parse(xml);
		expect(doc.documentElement.tagName).toBe("score-partwise");
		expect(doc.documentElement.getAttribute("version")).toBe("4.0");
		expect(doc.querySelector("score-part")?.getAttribute("id")).toBe("P1");
		expect(doc.querySelector("part-name")?.textContent).toBe("Piano");
		expect(doc.querySelectorAll("part")).toHaveLength(1);
		expect(doc.querySelectorAll("measure")).toHaveLength(1);
		expect(doc.querySelector("measure")?.getAttribute("number")).toBe("1");
		expect(doc.querySelector("divisions")?.textContent).toBe("4");
		expect(doc.querySelector("clef > sign")?.textContent).toBe("G");
		expect(doc.querySelector("clef > line")?.textContent).toBe("2");
		expect(doc.querySelector("time")).toBeNull();
		expect(noteSummary(doc)).toEqual([
			{
				rest: false,
				step: "C",
				octave: "4",
				duration: "4",
				type: "quarter",
				order: ["pitch", "duration", "type"],
			},
			{
				rest: true,
				step: undefined,
				octave: undefined,
				duration: "8",
				type: "half",
				order: ["rest", "duration", "type"],
			},
			{
				rest: false,
				step: "G",
				octave: "5",
				duration: "2",
				type: "eighth",
				order: ["pitch", "duration", "type"],
			},
		]);
	});

	it("produit une mesure sans note pour une partition vide", () => {
		const doc = parse(toMusicXml([]));
		expect(doc.querySelectorAll("measure")).toHaveLength(1);
		expect(doc.querySelector("measure > attributes")).not.toBeNull();
		expect(doc.querySelectorAll("note")).toHaveLength(0);
	});

	it("convertit les cinq durées en divisions et en type", () => {
		const durations = ["w", "h", "q", "8", "16"] as const;
		const doc = parse(
			toMusicXml(durations.map((duration) => ({ kind: "rest", duration }))),
		);
		expect(noteSummary(doc).map((n) => [n.duration, n.type])).toEqual([
			["16", "whole"],
			["8", "half"],
			["4", "quarter"],
			["2", "eighth"],
			["1", "16th"],
		]);
	});

	it("conserve les octaves extrêmes la3 et do6", () => {
		const doc = parse(
			toMusicXml([
				{ kind: "note", pitch: { step: "a", octave: 3 }, duration: "q" },
				{ kind: "note", pitch: { step: "c", octave: 6 }, duration: "q" },
			]),
		);
		expect(noteSummary(doc).map((n) => [n.step, n.octave])).toEqual([
			["A", "3"],
			["C", "6"],
		]);
	});

	it("lève une RangeError pour une durée invalide", () => {
		const bad = [{ kind: "rest", duration: "32" }] as unknown as Score;
		expect(() => toMusicXml(bad)).toThrow(RangeError);
	});

	it("lève une RangeError pour une note de durée invalide", () => {
		const bad = [
			{ kind: "note", pitch: { step: "c", octave: 4 }, duration: "32" },
		] as unknown as Score;
		expect(() => toMusicXml(bad)).toThrow(RangeError);
	});

	it("lève une RangeError pour une hauteur invalide", () => {
		const badStep = [
			{ kind: "note", pitch: { step: "h", octave: 4 }, duration: "q" },
		] as unknown as Score;
		const badOctave = [
			{ kind: "note", pitch: { step: "c", octave: 4.5 }, duration: "q" },
		] as unknown as Score;
		expect(() => toMusicXml(badStep)).toThrow(RangeError);
		expect(() => toMusicXml(badOctave)).toThrow(RangeError);
	});
});

const wrap = (measures: string, extra = "") =>
	`<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">${measures}</part>${extra}</score-partwise>`;
const noteXml = (step: string, octave: number, type: string, more = "") =>
	`<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><type>${type}</type>${more}</note>`;

describe("fromMusicXml", () => {
	it("réimporte à l'identique un export (notes, silences, durées)", () => {
		const score: Score = [
			{ kind: "note", pitch: { step: "c", octave: 4 }, duration: "q" },
			{ kind: "rest", duration: "h" },
			{ kind: "note", pitch: { step: "g", octave: 5 }, duration: "8" },
			{ kind: "rest", duration: "16" },
			{ kind: "note", pitch: { step: "a", octave: 3 }, duration: "w" },
		];
		const result = fromMusicXml(toMusicXml(score));
		expect(result.score).toEqual(score);
		expect(result.warnings).toEqual([]);
	});

	it("réimporte une partition vide", () => {
		expect(fromMusicXml(toMusicXml([]))).toEqual({ score: [], warnings: [] });
	});

	it("concatène les mesures de la première partie", () => {
		const xml = wrap(
			`<measure number="1">${noteXml("C", 4, "quarter")}</measure><measure number="2">${noteXml("D", 4, "half")}</measure>`,
		);
		expect(fromMusicXml(xml).score.map((e) => e.duration)).toEqual(["q", "h"]);
	});

	it("déduit la durée de <duration> quand <type> manque", () => {
		const xml = wrap(
			'<measure number="1"><attributes><divisions>1</divisions></attributes><note><rest/><duration>4</duration></note></measure>',
		);
		expect(fromMusicXml(xml).score).toEqual([{ kind: "rest", duration: "w" }]);
	});

	it("signale et ignore accords, altérations, points, armure et chiffrage", () => {
		const xml = wrap(
			`<measure number="1"><attributes><divisions>4</divisions><key><fifths>2</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
			<note><pitch><step>C</step><alter>1</alter><octave>4</octave></pitch><duration>6</duration><type>quarter</type><dot/></note>
			${noteXml("E", 4, "quarter")}
			<note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
			<direction/></measure>`,
		);
		const result = fromMusicXml(xml);
		expect(result.score).toEqual([
			{ kind: "note", pitch: { step: "c", octave: 4 }, duration: "q" },
			{ kind: "note", pitch: { step: "e", octave: 4 }, duration: "q" },
		]);
		expect(result.warnings).toEqual(
			expect.arrayContaining([
				"Armure ignorée",
				"Chiffrage de mesure ignoré",
				"Altérations (dièses, bémols) ignorées",
				"Élément « dot » ignoré",
				"Élément « chord » ignoré",
				"Élément « direction » ignoré",
			]),
		);
		expect(new Set(result.warnings).size).toBe(result.warnings.length);
	});

	it("signale les parties supplémentaires, les notes hors étendue et les durées inconnues", () => {
		const xml = wrap(
			`<measure number="1">${noteXml("C", 2, "quarter")}${noteXml("C", 4, "32nd")}${noteXml("D", 4, "quarter")}</measure>`,
			"",
		).replace("</part>", '</part><part id="P2"><measure number="1"/></part>');
		const result = fromMusicXml(xml);
		expect(result.score).toEqual([
			{ kind: "note", pitch: { step: "d", octave: 4 }, duration: "q" },
		]);
		expect(result.warnings).toEqual(
			expect.arrayContaining([
				"Seule la première partie est importée",
				"Notes hors de l'étendue de la portée ignorées",
				"Notes de durée non prise en charge ignorées",
			]),
		);
	});

	it.each([
		["du texte quelconque", "pas du xml", /XML valide/],
		["un XML mal formé", "<score-partwise><part>", /XML valide/],
		["un format timewise", "<score-timewise/>", /partwise/],
		["une partition sans partie", "<score-partwise/>", /aucune partie/],
		["une chaîne vide", "", /XML valide/],
	])("rejette %s avec un message clair", (_label, xml, message) => {
		expect(() => fromMusicXml(xml)).toThrow(message);
	});
});
