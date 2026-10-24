import { describe, expect, it } from "vitest";
import {
	assertSettings,
	CLEF_NAMES,
	CLEFS,
	DEFAULT_SETTINGS,
	deleteElement,
	durationTicks,
	fillName,
	insertElement,
	insertionIndex,
	keySignatureName,
	measureCapacity,
	movePitch,
	pitchFromY,
	pitchName,
	type Score,
	splitMeasures,
	TIME_SIGNATURES,
	timeName,
	yForPitch,
} from "../src/score";

const TOP = 60;
const SPACING = 10;

const note = (step: "c" | "d" | "e" | "f" | "g" | "a" | "b", octave: number) =>
	({
		kind: "note",
		pitch: { step, octave },
		duration: "q",
	}) as const;
const rest = { kind: "rest", duration: "h" } as const;

describe("pitchName", () => {
	it("nomme les notes en français avec leur octave", () => {
		expect(pitchName({ step: "c", octave: 4 })).toBe("do4");
		expect(pitchName({ step: "d", octave: 4 })).toBe("ré4");
		expect(pitchName({ step: "g", octave: 4 })).toBe("sol4");
		expect(pitchName({ step: "b", octave: 5 })).toBe("si5");
	});
});

describe("pitchFromY", () => {
	it("place mi4 sur la ligne du bas et fa5 sur la ligne du haut en clé de sol", () => {
		expect(pitchFromY(100, TOP, SPACING)).toEqual({ step: "e", octave: 4 });
		expect(pitchFromY(60, TOP, SPACING)).toEqual({ step: "f", octave: 5 });
	});

	it("place sol4 sur la deuxième ligne et fa4 dans l'interligne du bas", () => {
		expect(pitchFromY(90, TOP, SPACING)).toEqual({ step: "g", octave: 4 });
		expect(pitchFromY(105, TOP, SPACING)).toEqual({ step: "d", octave: 4 });
		expect(pitchFromY(95, TOP, SPACING)).toEqual({ step: "f", octave: 4 });
	});

	it("choisit la hauteur la plus proche quand le clic tombe entre deux positions", () => {
		expect(pitchFromY(92, TOP, SPACING)).toEqual({ step: "g", octave: 4 });
		expect(pitchFromY(93, TOP, SPACING)).toEqual({ step: "f", octave: 4 });
	});

	it("accepte les bornes la3 et do6", () => {
		expect(pitchFromY(120, TOP, SPACING)).toEqual({ step: "a", octave: 3 });
		expect(pitchFromY(40, TOP, SPACING)).toEqual({ step: "c", octave: 6 });
	});

	it("renvoie null hors de l'étendue utilisable", () => {
		expect(pitchFromY(124, TOP, SPACING)).toBeNull();
		expect(pitchFromY(36, TOP, SPACING)).toBeNull();
		expect(pitchFromY(0, TOP, SPACING)).toBeNull();
	});

	it("rejette une coordonnée non numérique", () => {
		expect(() => pitchFromY(Number.NaN, TOP, SPACING)).toThrow(RangeError);
	});
});

describe("yForPitch", () => {
	it("est l'inverse de pitchFromY", () => {
		expect(yForPitch({ step: "e", octave: 4 }, TOP, SPACING)).toBe(100);
		expect(yForPitch({ step: "c", octave: 4 }, TOP, SPACING)).toBe(110);
		expect(yForPitch({ step: "c", octave: 6 }, TOP, SPACING)).toBe(40);
	});
});

describe("yForPitch / pitchFromY selon la clé", () => {
	it("place la ligne du haut sur la3 en clé de fa et sol4 en clé d'ut", () => {
		expect(yForPitch({ step: "a", octave: 3 }, TOP, SPACING, "bass")).toBe(60);
		expect(yForPitch({ step: "g", octave: 2 }, TOP, SPACING, "bass")).toBe(100);
		expect(yForPitch({ step: "c", octave: 3 }, TOP, SPACING, "bass")).toBe(85);
		expect(yForPitch({ step: "g", octave: 4 }, TOP, SPACING, "alto")).toBe(60);
		expect(yForPitch({ step: "f", octave: 3 }, TOP, SPACING, "alto")).toBe(100);
		expect(yForPitch({ step: "c", octave: 4 }, TOP, SPACING, "alto")).toBe(80);
	});

	it("lit les hauteurs en clé de fa et d'ut", () => {
		expect(pitchFromY(100, TOP, SPACING, "bass")).toEqual({
			step: "g",
			octave: 2,
		});
		expect(pitchFromY(85, TOP, SPACING, "bass")).toEqual({
			step: "c",
			octave: 3,
		});
		expect(pitchFromY(80, TOP, SPACING, "alto")).toEqual({
			step: "c",
			octave: 4,
		});
		expect(pitchFromY(60, TOP, SPACING, "alto")).toEqual({
			step: "g",
			octave: 4,
		});
	});

	it("borne la fenêtre cliquable à do2-mi4 en clé de fa et si2-ré5 en clé d'ut", () => {
		expect(pitchFromY(120, TOP, SPACING, "bass")).toEqual({
			step: "c",
			octave: 2,
		});
		expect(pitchFromY(40, TOP, SPACING, "bass")).toEqual({
			step: "e",
			octave: 4,
		});
		expect(pitchFromY(124, TOP, SPACING, "bass")).toBeNull();
		expect(pitchFromY(36, TOP, SPACING, "bass")).toBeNull();
		expect(pitchFromY(120, TOP, SPACING, "alto")).toEqual({
			step: "b",
			octave: 2,
		});
		expect(pitchFromY(40, TOP, SPACING, "alto")).toEqual({
			step: "d",
			octave: 5,
		});
		expect(pitchFromY(36, TOP, SPACING, "alto")).toBeNull();
	});
});

describe("réglages", () => {
	it("expose les clés, chiffrages et réglages par défaut", () => {
		expect(CLEFS).toEqual(["treble", "bass", "alto"]);
		expect(CLEF_NAMES).toEqual({ treble: "sol", bass: "fa", alto: "ut" });
		expect(TIME_SIGNATURES.map(timeName)).toEqual([
			"2/4",
			"3/4",
			"4/4",
			"2/2",
			"3/8",
			"6/8",
			"9/8",
			"12/8",
		]);
		expect(DEFAULT_SETTINGS).toEqual({
			clef: "treble",
			fifths: 0,
			time: { beats: 4, beatType: 4 },
		});
	});

	it("nomme les armures en français", () => {
		expect(keySignatureName(0)).toBe("Do majeur");
		expect(keySignatureName(1)).toBe("1 dièse");
		expect(keySignatureName(2)).toBe("2 dièses");
		expect(keySignatureName(-1)).toBe("1 bémol");
		expect(keySignatureName(-3)).toBe("3 bémols");
		expect(keySignatureName(7)).toBe("7 dièses");
		expect(keySignatureName(-7)).toBe("7 bémols");
	});

	it("rejette une armure hors de -7..7 ou non entière", () => {
		expect(() => keySignatureName(8)).toThrow(RangeError);
		expect(() => keySignatureName(1.5)).toThrow(RangeError);
	});

	it("valide des réglages corrects", () => {
		expect(() =>
			assertSettings({
				clef: "bass",
				fifths: -7,
				time: { beats: 6, beatType: 8 },
			}),
		).not.toThrow();
	});

	it("rejette des réglages invalides", () => {
		const ok = DEFAULT_SETTINGS;
		expect(() => assertSettings({ ...ok, fifths: 8 })).toThrow(RangeError);
		expect(() => assertSettings({ ...ok, fifths: 1.5 })).toThrow(RangeError);
		expect(() => assertSettings({ ...ok, clef: "tenor" as never })).toThrow(
			RangeError,
		);
		expect(() =>
			assertSettings({ ...ok, time: { beats: 5, beatType: 4 } }),
		).toThrow(RangeError);
	});
});

describe("durées et mesures", () => {
	const el = (duration: "w" | "h" | "q" | "8" | "16") =>
		({ kind: "rest", duration }) as const;
	const C44 = { beats: 4, beatType: 4 };

	it("convertit les durées en doubles croches", () => {
		expect(durationTicks("w")).toBe(16);
		expect(durationTicks("h")).toBe(8);
		expect(durationTicks("q")).toBe(4);
		expect(durationTicks("8")).toBe(2);
		expect(durationTicks("16")).toBe(1);
	});

	it("calcule la capacité d'une mesure", () => {
		expect(measureCapacity(C44)).toBe(16);
		expect(measureCapacity({ beats: 3, beatType: 4 })).toBe(12);
		expect(measureCapacity({ beats: 6, beatType: 8 })).toBe(12);
		expect(measureCapacity({ beats: 2, beatType: 2 })).toBe(16);
		expect(measureCapacity({ beats: 3, beatType: 8 })).toBe(6);
	});

	it("renvoie une seule mesure vide pour une partition vide", () => {
		expect(splitMeasures([], C44)).toEqual([
			{ start: 0, end: 0, ticks: 0, capacity: 16, status: "empty" },
		]);
	});

	it("découpe en mesures complètes sans mesure vide finale", () => {
		const score: Score = [el("h"), el("h"), el("w")];
		expect(splitMeasures(score, C44)).toEqual([
			{ start: 0, end: 2, ticks: 16, capacity: 16, status: "complete" },
			{ start: 2, end: 3, ticks: 16, capacity: 16, status: "complete" },
		]);
	});

	it("marque incomplète la dernière mesure partiellement remplie", () => {
		const score: Score = [el("w"), el("q")];
		expect(splitMeasures(score, C44)).toEqual([
			{ start: 0, end: 1, ticks: 16, capacity: 16, status: "complete" },
			{ start: 1, end: 2, ticks: 4, capacity: 16, status: "incomplete" },
		]);
	});

	it("laisse déborder une mesure avec un élément trop long", () => {
		const score: Score = [el("h"), el("h"), el("q"), el("w")];
		const measures = splitMeasures(score, { beats: 3, beatType: 4 });
		expect(measures).toEqual([
			{ start: 0, end: 2, ticks: 16, capacity: 12, status: "overfull" },
			{ start: 2, end: 4, ticks: 20, capacity: 12, status: "overfull" },
		]);
	});

	it("découpe en 6/8 avec des silences", () => {
		const score: Score = [el("q"), el("8"), el("q"), el("8"), el("q")];
		expect(splitMeasures(score, { beats: 6, beatType: 8 })).toEqual([
			{ start: 0, end: 4, ticks: 12, capacity: 12, status: "complete" },
			{ start: 4, end: 5, ticks: 4, capacity: 12, status: "incomplete" },
		]);
	});
});

describe("insertionIndex", () => {
	it("insère selon l'ordre des abscisses", () => {
		expect(insertionIndex([50, 100, 150], 10)).toBe(0);
		expect(insertionIndex([50, 100, 150], 120)).toBe(2);
		expect(insertionIndex([50, 100, 150], 400)).toBe(3);
		expect(insertionIndex([], 30)).toBe(0);
	});
});

describe("insertElement", () => {
	it("insère à l'index demandé sans modifier la partition d'origine", () => {
		const score: Score = [note("c", 4), note("e", 4)];
		const result = insertElement(score, rest, 1);
		expect(result).toEqual([note("c", 4), rest, note("e", 4)]);
		expect(score).toHaveLength(2);
	});

	it("insère en fin de partition", () => {
		expect(insertElement([note("c", 4)], rest, 1)).toEqual([
			note("c", 4),
			rest,
		]);
	});

	it("rejette un index hors bornes", () => {
		expect(() => insertElement([], rest, 1)).toThrow(RangeError);
		expect(() => insertElement([], rest, -1)).toThrow(RangeError);
		expect(() => insertElement([], rest, 0.5)).toThrow(RangeError);
	});

	it("rejette une durée inconnue", () => {
		expect(() =>
			insertElement([], { kind: "rest", duration: "32" as never }, 0),
		).toThrow(RangeError);
	});

	it("rejette une hauteur hors de l'étendue", () => {
		expect(() => insertElement([], note("c", 1), 0)).toThrow(RangeError);
		expect(() => insertElement([], note("d", 7), 0)).toThrow(RangeError);
	});

	it("accepte les bornes absolues do2 et do7 quelle que soit la clé", () => {
		expect(insertElement([], note("c", 2), 0)).toEqual([note("c", 2)]);
		expect(insertElement([], note("c", 7), 0)).toEqual([note("c", 7)]);
	});
});

describe("movePitch", () => {
	it("monte sol4 en la4 d'un degré diatonique", () => {
		expect(movePitch([note("g", 4)], 0, 1)).toEqual([note("a", 4)]);
	});

	it("passe à l'octave suivante de si4 à do5 et à la précédente de do4 à si3", () => {
		expect(movePitch([note("b", 4)], 0, 1)).toEqual([note("c", 5)]);
		expect(movePitch([note("c", 4)], 0, -1)).toEqual([note("b", 3)]);
	});

	it("ne modifie que la note ciblée et conserve sa durée", () => {
		const score: Score = [note("c", 4), note("e", 4)];
		const result = movePitch(score, 1, -1);
		expect(result).toEqual([note("c", 4), note("d", 4)]);
		expect(score[1]).toEqual(note("e", 4));
	});

	it("est sans effet sur un silence", () => {
		expect(movePitch([rest], 0, 1)).toEqual([rest]);
	});

	it("reste dans l'étendue aux bornes do2 et do7", () => {
		expect(movePitch([note("c", 7)], 0, 1)).toEqual([note("c", 7)]);
		expect(movePitch([note("c", 2)], 0, -1)).toEqual([note("c", 2)]);
		expect(movePitch([note("c", 6)], 0, 1)).toEqual([note("d", 6)]);
	});

	it("rejette un index inexistant", () => {
		expect(() => movePitch([], 0, 1)).toThrow(RangeError);
		expect(() => movePitch([note("c", 4)], 1, 1)).toThrow(RangeError);
	});
});

describe("deleteElement", () => {
	it("supprime l'élément et sélectionne son voisin de droite", () => {
		const result = deleteElement([note("c", 4), rest, note("e", 4)], 1);
		expect(result.score).toEqual([note("c", 4), note("e", 4)]);
		expect(result.selected).toBe(1);
	});

	it("sélectionne le voisin de gauche quand on supprime le dernier", () => {
		const result = deleteElement([note("c", 4), rest], 1);
		expect(result.score).toEqual([note("c", 4)]);
		expect(result.selected).toBe(0);
	});

	it("ne sélectionne rien quand la partition devient vide", () => {
		expect(deleteElement([rest], 0)).toEqual({ score: [], selected: null });
	});

	it("rejette un index inexistant", () => {
		expect(() => deleteElement([], 0)).toThrow(RangeError);
		expect(() => deleteElement([rest], -1)).toThrow(RangeError);
	});
});

describe("fillName", () => {
	it("exprime la durée en fraction de ronde réduite", () => {
		expect(fillName(3)).toBe("3/16");
		expect(fillName(8)).toBe("1/2");
		expect(fillName(20)).toBe("5/4");
		expect(fillName(12)).toBe("3/4");
	});
	it("écrit 0 pour une durée nulle et un entier pour des rondes entières", () => {
		expect(fillName(0)).toBe("0");
		expect(fillName(16)).toBe("1");
		expect(fillName(32)).toBe("2");
	});
	it("rejette une durée négative ou non entière", () => {
		expect(() => fillName(-1)).toThrow(RangeError);
		expect(() => fillName(1.5)).toThrow(RangeError);
	});
});
