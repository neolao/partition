import {
	DURATIONS,
	type Duration,
	insertElement,
	type Pitch,
	type Score,
	type ScoreElement,
	STEPS,
	type Step,
} from "./score";

// Résolution : 4 divisions par noire.
const DIVISIONS = 4;

const DIVISIONS_BY_DURATION: Record<Duration, number> = {
	w: 16,
	h: 8,
	q: 4,
	"8": 2,
	"16": 1,
};

const TYPE_BY_DURATION: Record<Duration, string> = {
	w: "whole",
	h: "half",
	q: "quarter",
	"8": "eighth",
	"16": "16th",
};

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">`;

function noteXml(element: ScoreElement): string {
	if (!DURATIONS.includes(element.duration)) {
		throw new RangeError(`Durée invalide : ${String(element.duration)}`);
	}
	if (element.kind === "note") {
		const { step, octave } = element.pitch;
		if (!/^[a-g]$/.test(step) || !Number.isInteger(octave)) {
			throw new RangeError(`Hauteur invalide : ${step}${octave}`);
		}
	}
	const body =
		element.kind === "rest"
			? "<rest/>"
			: `<pitch><step>${element.pitch.step.toUpperCase()}</step><octave>${element.pitch.octave}</octave></pitch>`;
	return `<note>${body}<duration>${DIVISIONS_BY_DURATION[element.duration]}</duration><type>${TYPE_BY_DURATION[element.duration]}</type></note>`;
}

/** Convertit la partition en document MusicXML 4.0 (score-partwise, une seule mesure). */
export function toMusicXml(score: Score): string {
	const notes = score.map(noteXml).join("\n      ");
	return `${HEADER}
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>${DIVISIONS}</divisions><clef><sign>G</sign><line>2</line></clef></attributes>${notes ? `\n      ${notes}` : ""}
    </measure>
  </part>
</score-partwise>
`;
}

const DURATION_BY_TYPE: Record<string, Duration> = Object.fromEntries(
	Object.entries(TYPE_BY_DURATION).map(([duration, type]) => [
		type,
		duration as Duration,
	]),
);

// Éléments de note ou de mesure que l'éditeur ne sait pas représenter.
const UNSUPPORTED_NOTE_CHILDREN = ["chord", "grace", "dot", "tie", "lyric"];
const UNSUPPORTED_MEASURE_CHILDREN = [
	"direction",
	"harmony",
	"backup",
	"forward",
];

export interface ImportResult {
	score: Score;
	/** Éléments du fichier ignorés, sans doublon, formulés pour l'utilisateur. */
	warnings: string[];
}

const childrenNamed = (parent: Element, name: string): Element[] =>
	[...parent.children].filter((child) => child.localName === name);

const childText = (parent: Element, name: string): string | undefined =>
	childrenNamed(parent, name)[0]?.textContent?.trim();

function durationOf(note: Element, divisions: number): Duration | null {
	const type = childText(note, "type");
	if (type !== undefined) {
		return DURATION_BY_TYPE[type] ?? null;
	}
	// Sans <type> (silence de mesure entière notamment), on déduit la durée de <duration>.
	const length = Number(childText(note, "duration"));
	const fromLength = (Object.keys(DIVISIONS_BY_DURATION) as Duration[]).find(
		(candidate) =>
			(DIVISIONS_BY_DURATION[candidate] * divisions) / DIVISIONS === length,
	);
	return fromLength ?? null;
}

function pitchOf(note: Element, warnings: Set<string>): Pitch | null {
	const pitch = childrenNamed(note, "pitch")[0];
	if (!pitch) {
		return null;
	}
	const step = childText(pitch, "step")?.toLowerCase();
	const octave = Number(childText(pitch, "octave"));
	if (!step || !STEPS.includes(step as Step) || !Number.isInteger(octave)) {
		return null;
	}
	if (Number(childText(pitch, "alter") ?? 0) !== 0) {
		warnings.add("Altérations (dièses, bémols) ignorées");
	}
	return { step: step as Step, octave };
}

function readAttributes(
	attributes: Element,
	warnings: Set<string>,
	divisions: number,
): number {
	const key = childrenNamed(attributes, "key")[0];
	if (key && Number(childText(key, "fifths") ?? 0) !== 0) {
		warnings.add("Armure ignorée");
	}
	if (childrenNamed(attributes, "time").length > 0) {
		warnings.add("Chiffrage de mesure ignoré");
	}
	const clef = childrenNamed(attributes, "clef")[0];
	if (
		clef &&
		(childText(clef, "sign") !== "G" || childText(clef, "line") !== "2")
	) {
		warnings.add("Clé autre que la clé de sol ignorée");
	}
	const declared = Number(childText(attributes, "divisions"));
	return Number.isFinite(declared) && declared > 0 ? declared : divisions;
}

/**
 * Lit un document MusicXML (score-partwise) et le convertit en partition.
 * Lève une Error au message lisible si le document est invalide ou d'un format non pris en charge.
 */
export function fromMusicXml(xml: string): ImportResult {
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	const root = doc.documentElement;
	if (!root || doc.getElementsByTagName("parsererror").length > 0) {
		throw new Error("Le fichier n'est pas un document XML valide");
	}
	if (root.localName !== "score-partwise") {
		throw new Error("Seul le format MusicXML « partwise » est pris en charge");
	}
	const parts = childrenNamed(root, "part");
	if (parts.length === 0) {
		throw new Error("Le fichier ne contient aucune partie musicale");
	}

	const warnings = new Set<string>();
	if (parts.length > 1) {
		warnings.add("Seule la première partie est importée");
	}
	let score: Score = [];
	let divisions = DIVISIONS;
	for (const measure of childrenNamed(parts[0], "measure")) {
		for (const child of measure.children) {
			if (child.localName === "attributes") {
				divisions = readAttributes(child, warnings, divisions);
			} else if (UNSUPPORTED_MEASURE_CHILDREN.includes(child.localName)) {
				warnings.add(`Élément « ${child.localName} » ignoré`);
			} else if (child.localName === "note") {
				for (const name of UNSUPPORTED_NOTE_CHILDREN) {
					if (childrenNamed(child, name).length > 0) {
						warnings.add(`Élément « ${name} » ignoré`);
					}
				}
				if (
					childrenNamed(child, "chord").length > 0 ||
					childrenNamed(child, "grace").length > 0
				) {
					continue;
				}
				const duration = durationOf(child, divisions);
				if (duration === null) {
					warnings.add("Notes de durée non prise en charge ignorées");
					continue;
				}
				const isRest = childrenNamed(child, "rest").length > 0;
				const pitch = isRest ? null : pitchOf(child, warnings);
				if (!isRest && pitch === null) {
					warnings.add("Notes sans hauteur valide ignorées");
					continue;
				}
				const element: ScoreElement = pitch
					? { kind: "note", pitch, duration }
					: { kind: "rest", duration };
				try {
					score = insertElement(score, element, score.length);
				} catch (error) {
					if (!(error instanceof RangeError)) {
						throw error;
					}
					warnings.add("Notes hors de l'étendue de la portée ignorées");
				}
			}
		}
	}
	return { score, warnings: [...warnings] };
}
