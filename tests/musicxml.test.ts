// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { toMusicXml } from "../src/musicxml";
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
