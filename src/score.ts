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

// Étendue absolue acceptée, indépendante de la clé : do2 à do7.
const LOWEST = toDiatonic({ step: "c", octave: 2 });
const HIGHEST = toDiatonic({ step: "c", octave: 7 });

export const CLEFS = ["treble", "bass", "alto"] as const;
export type Clef = (typeof CLEFS)[number];

export const CLEF_NAMES: Record<Clef, string> = {
	treble: "sol",
	bass: "fa",
	alto: "ut",
};

// Hauteur de la ligne du haut de la portée : fa5, la3, sol4.
const TOP_LINES: Record<Clef, number> = {
	treble: toDiatonic({ step: "f", octave: 5 }),
	bass: toDiatonic({ step: "a", octave: 3 }),
	alto: toDiatonic({ step: "g", octave: 4 }),
};
// Fenêtre cliquable, en degrés autour de la ligne du haut.
const DEGREES_BELOW_TOP = 12;
const DEGREES_ABOVE_TOP = 4;

export interface TimeSignature {
	beats: number;
	beatType: number;
}

export const TIME_SIGNATURES: readonly TimeSignature[] = [
	{ beats: 2, beatType: 4 },
	{ beats: 3, beatType: 4 },
	{ beats: 4, beatType: 4 },
	{ beats: 2, beatType: 2 },
	{ beats: 3, beatType: 8 },
	{ beats: 6, beatType: 8 },
	{ beats: 9, beatType: 8 },
	{ beats: 12, beatType: 8 },
];

export interface Settings {
	clef: Clef;
	/** Nombre d'altérations à l'armure : > 0 dièses, < 0 bémols (-7 à 7). */
	fifths: number;
	time: TimeSignature;
}

export const DEFAULT_SETTINGS: Settings = {
	clef: "treble",
	fifths: 0,
	time: { beats: 4, beatType: 4 },
};

function assertFifths(fifths: number): void {
	if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) {
		throw new RangeError(`Armure invalide : ${fifths}`);
	}
}

/** Nom français d'une armure, par exemple « 2 dièses ». */
export function keySignatureName(fifths: number): string {
	assertFifths(fifths);
	if (fifths === 0) {
		return "Do majeur";
	}
	const count = Math.abs(fifths);
	const noun = fifths > 0 ? "dièse" : "bémol";
	return `${count} ${noun}${count > 1 ? "s" : ""}`;
}

/** Chiffrage affiché, par exemple « 6/8 ». */
export function timeName(time: TimeSignature): string {
	return `${time.beats}/${time.beatType}`;
}

export function assertSettings(settings: Settings): void {
	if (!CLEFS.includes(settings.clef)) {
		throw new RangeError(`Clé inconnue : ${settings.clef}`);
	}
	assertFifths(settings.fifths);
	const { beats, beatType } = settings.time;
	if (
		!TIME_SIGNATURES.some((t) => t.beats === beats && t.beatType === beatType)
	) {
		throw new RangeError(`Chiffrage invalide : ${beats}/${beatType}`);
	}
}

const DURATION_TICKS: Record<Duration, number> = {
	w: 16,
	h: 8,
	q: 4,
	"8": 2,
	"16": 1,
};

/** Durée en doubles croches. */
export function durationTicks(duration: Duration): number {
	return DURATION_TICKS[duration];
}

/** Capacité d'une mesure en doubles croches. */
export function measureCapacity(time: TimeSignature): number {
	return (time.beats * 16) / time.beatType;
}

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

/** Durée saisie en fraction de ronde réduite, par exemple « 3/16 » (0 pour rien, « 1 » pour une ronde). */
export function fillName(ticks: number): string {
	if (!Number.isInteger(ticks) || ticks < 0) {
		throw new RangeError(`Durée invalide : ${ticks}`);
	}
	if (ticks === 0) {
		return "0";
	}
	const divisor = gcd(ticks, 16);
	const denominator = 16 / divisor;
	return denominator === 1
		? String(ticks / divisor)
		: `${ticks / divisor}/${denominator}`;
}

export type MeasureStatus = "empty" | "incomplete" | "complete" | "overfull";

export interface Measure {
	/** Index du premier élément. */
	start: number;
	/** Index suivant le dernier élément (exclu). */
	end: number;
	ticks: number;
	capacity: number;
	status: MeasureStatus;
}

function measureOf(
	start: number,
	end: number,
	ticks: number,
	capacity: number,
): Measure {
	let status: MeasureStatus = "incomplete";
	if (ticks === 0) {
		status = "empty";
	} else if (ticks === capacity) {
		status = "complete";
	} else if (ticks > capacity) {
		status = "overfull";
	}
	return { start, end, ticks, capacity, status };
}

/** Répartit les éléments en mesures : une mesure reçoit des éléments tant qu'elle n'est pas pleine. */
export function splitMeasures(score: Score, time: TimeSignature): Measure[] {
	const capacity = measureCapacity(time);
	const measures: Measure[] = [];
	let start = 0;
	let ticks = 0;
	score.forEach((element, i) => {
		ticks += durationTicks(element.duration);
		if (ticks >= capacity) {
			measures.push(measureOf(start, i + 1, ticks, capacity));
			start = i + 1;
			ticks = 0;
		}
	});
	if (start < score.length || measures.length === 0) {
		measures.push(measureOf(start, score.length, ticks, capacity));
	}
	return measures;
}

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
	clef: Clef = "treble",
): number {
	return topLineY + (TOP_LINES[clef] - toDiatonic(pitch)) * (spacing / 2);
}

/** Hauteur la plus proche de l'ordonnée donnée, ou null hors de la fenêtre cliquable de la clé. */
export function pitchFromY(
	y: number,
	topLineY: number,
	spacing: number,
	clef: Clef = "treble",
): Pitch | null {
	if (!Number.isFinite(y)) {
		throw new RangeError(`Ordonnée invalide : ${y}`);
	}
	const top = TOP_LINES[clef];
	const position = Math.round(top - (y - topLineY) / (spacing / 2));
	if (
		position < top - DEGREES_BELOW_TOP ||
		position > top + DEGREES_ABOVE_TOP
	) {
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
