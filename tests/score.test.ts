import { describe, expect, it } from "vitest";
import {
	deleteElement,
	insertElement,
	insertionIndex,
	movePitch,
	pitchFromY,
	pitchName,
	type Score,
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
		expect(() => insertElement([], note("g", 2), 0)).toThrow(RangeError);
		expect(() => insertElement([], note("d", 6), 0)).toThrow(RangeError);
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

	it("reste dans l'étendue aux bornes la3 et do6", () => {
		expect(movePitch([note("c", 6)], 0, 1)).toEqual([note("c", 6)]);
		expect(movePitch([note("a", 3)], 0, -1)).toEqual([note("a", 3)]);
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
