/** Modèle pur de la partition : aucune dépendance au DOM ni à VexFlow. */

export const DURATIONS = ["w", "h", "q", "8", "16"] as const;
export type Duration = (typeof DURATIONS)[number];

export const DURATION_NAMES: Record<Duration, string> = {
	w: "ronde",
	h: "blanche",
	q: "noire",
	"8": "croche",
	"16": "double croche",
};

export const STEPS = ["c", "d", "e", "f", "g", "a", "b"] as const;
export type Step = (typeof STEPS)[number];

const STEP_NAMES: Record<Step, string> = {
	c: "do",
	d: "ré",
	e: "mi",
	f: "fa",
	g: "sol",
	a: "la",
	b: "si",
};

export interface Pitch {
	step: Step;
	octave: number;
}

export type ScoreElement =
	| { kind: "note"; pitch: Pitch; duration: Duration }
	| { kind: "rest"; duration: Duration };

export type Score = readonly ScoreElement[];

/** Position diatonique absolue : 7 degrés par octave, do0 = 0. */
function toDiatonic(pitch: Pitch): number {
	return pitch.octave * 7 + STEPS.indexOf(pitch.step);
}

function fromDiatonic(index: number): Pitch {
	return { step: STEPS[index % 7], octave: Math.floor(index / 7) };
}

// Étendue utilisable en clé de sol : la3 à do6.
const LOWEST = toDiatonic({ step: "a", octave: 3 });
const HIGHEST = toDiatonic({ step: "c", octave: 6 });
// Ligne du haut de la portée en clé de sol : fa5.
const TOP_LINE = toDiatonic({ step: "f", octave: 5 });

function assertIndex(index: number, max: number): void {
	if (!Number.isInteger(index) || index < 0 || index > max) {
		throw new RangeError(`Index invalide : ${index}`);
	}
}

function assertElement(element: ScoreElement): void {
	if (!DURATIONS.includes(element.duration)) {
		throw new RangeError(`Durée invalide : ${element.duration}`);
	}
	if (element.kind === "note") {
		const { pitch } = element;
		if (!STEPS.includes(pitch.step) || !Number.isInteger(pitch.octave)) {
			throw new RangeError(`Hauteur invalide : ${pitch.step}${pitch.octave}`);
		}
		const position = toDiatonic(pitch);
		if (position < LOWEST || position > HIGHEST) {
			throw new RangeError(`Hauteur hors étendue : ${pitchName(pitch)}`);
		}
	}
}

/** Nom français d'une hauteur, par exemple « ré4 ». */
export function pitchName(pitch: Pitch): string {
	return `${STEP_NAMES[pitch.step]}${pitch.octave}`;
}

/** Ordonnée d'une hauteur ; les lignes sont espacées de `spacing`, la ligne du haut est à `topLineY`. */
export function yForPitch(
	pitch: Pitch,
	topLineY: number,
	spacing: number,
): number {
	return topLineY + (TOP_LINE - toDiatonic(pitch)) * (spacing / 2);
}

/** Hauteur la plus proche de l'ordonnée donnée, ou null hors de l'étendue utilisable. */
export function pitchFromY(
	y: number,
	topLineY: number,
	spacing: number,
): Pitch | null {
	if (!Number.isFinite(y)) {
		throw new RangeError(`Ordonnée invalide : ${y}`);
	}
	const position = Math.round(TOP_LINE - (y - topLineY) / (spacing / 2));
	if (position < LOWEST || position > HIGHEST) {
		return null;
	}
	return fromDiatonic(position);
}

/** Index d'insertion pour une abscisse, d'après les abscisses (triées) des éléments existants. */
export function insertionIndex(xs: readonly number[], x: number): number {
	return xs.filter((existing) => existing < x).length;
}

export function insertElement(
	score: Score,
	element: ScoreElement,
	index: number,
): Score {
	assertIndex(index, score.length);
	assertElement(element);
	return [...score.slice(0, index), element, ...score.slice(index)];
}

/** Déplace une note de `delta` degrés diatoniques ; sans effet sur un silence ou au-delà de l'étendue. */
export function movePitch(score: Score, index: number, delta: number): Score {
	assertIndex(index, score.length - 1);
	const element = score[index];
	if (element.kind !== "note") {
		return score;
	}
	const position = toDiatonic(element.pitch) + delta;
	if (position < LOWEST || position > HIGHEST) {
		return score;
	}
	const moved: ScoreElement = { ...element, pitch: fromDiatonic(position) };
	return score.map((existing, i) => (i === index ? moved : existing));
}

/** Supprime l'élément et indique celui à sélectionner ensuite (voisin de droite, sinon de gauche). */
export function deleteElement(
	score: Score,
	index: number,
): { score: Score; selected: number | null } {
	assertIndex(index, score.length - 1);
	const remaining = score.filter((_, i) => i !== index);
	return {
		score: remaining,
		selected:
			remaining.length === 0 ? null : Math.min(index, remaining.length - 1),
	};
}
