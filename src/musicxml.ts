import {
	assertSettings,
	type Clef,
	DEFAULT_SETTINGS,
	DURATIONS,
	type Duration,
	durationTicks,
	insertElement,
	type Pitch,
	type Score,
	type ScoreElement,
	type Settings,
	STEPS,
	type Step,
	splitMeasures,
	TIME_SIGNATURES,
} from "./score";

// Résolution : 4 divisions par noire.
const DIVISIONS = 4;

// Une division de MusicXML vaut une double croche (durationTicks) : 4 par noire.
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
	return `<note>${body}<duration>${durationTicks(element.duration)}</duration><type>${TYPE_BY_DURATION[element.duration]}</type></note>`;
}

const CLEF_SIGNS: Record<Clef, { sign: string; line: number }> = {
	treble: { sign: "G", line: 2 },
	bass: { sign: "F", line: 4 },
	alto: { sign: "C", line: 3 },
};

function attributesXml(settings: Settings): string {
	const { sign, line } = CLEF_SIGNS[settings.clef];
	const { beats, beatType } = settings.time;
	return `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${settings.fifths}</fifths></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time><clef><sign>${sign}</sign><line>${line}</line></clef></attributes>`;
}

/**
 * Convertit la partition en document MusicXML 4.0 (score-partwise), une mesure par mesure
 * du chiffrage des réglages. Lève une RangeError si les réglages ou un élément sont invalides.
 */
export function toMusicXml(
	score: Score,
	settings: Settings = DEFAULT_SETTINGS,
): string {
	assertSettings(settings);
	const notes = score.map(noteXml);
	const measures = splitMeasures(score, settings.time).map((measure, i) => {
		const content = [
			...(i === 0 ? [attributesXml(settings)] : []),
			...notes.slice(measure.start, measure.end),
		];
		const body = content.map((line) => `\n      ${line}`).join("");
		return `    <measure number="${i + 1}">${body}\n    </measure>`;
	});
	return `${HEADER}
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
${measures.join("\n")}
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
	settings: Settings;
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
	const fromLength = DURATIONS.find(
		(candidate) =>
			(durationTicks(candidate) * divisions) / DIVISIONS === length,
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

const CHANGE_WARNING =
	"Changement de clé, d'armure ou de chiffrage en cours de morceau ignoré";

/** Réglages lus dans le fichier : chaque réglage est fixé par le premier <attributes> qui le porte. */
interface SettingsReader {
	settings: Settings;
	/** Écriture brute déjà rencontrée de chaque réglage, pour repérer un changement. */
	seen: Map<string, string>;
	/** Vrai dès qu'un <attributes> a porté un réglage : les suivants ne peuvent plus rien changer. */
	locked: boolean;
}

function clefOf(clef: Element): Clef | null {
	const sign = childText(clef, "sign");
	const line = childText(clef, "line");
	const found = (Object.keys(CLEF_SIGNS) as Clef[]).find(
		(name) =>
			CLEF_SIGNS[name].sign === sign && String(CLEF_SIGNS[name].line) === line,
	);
	return found ?? null;
}

function readAttributes(
	attributes: Element,
	reader: SettingsReader,
	warnings: Set<string>,
	divisions: number,
): number {
	// Vrai si le réglage est à appliquer (premier <attributes> porteur de réglages).
	const applies = (name: string, raw: string): boolean => {
		const previous = reader.seen.get(name);
		if (!reader.locked) {
			reader.seen.set(name, raw);
			return true;
		}
		if (previous !== raw) {
			warnings.add(CHANGE_WARNING);
		}
		return false;
	};

	const clef = childrenNamed(attributes, "clef")[0];
	if (clef) {
		const raw = `${childText(clef, "sign")}${childText(clef, "line")}`;
		if (applies("clef", raw)) {
			const found = clefOf(clef);
			if (found) {
				reader.settings.clef = found;
			} else {
				warnings.add("Clé non prise en charge ignorée");
			}
		}
	}
	const key = childrenNamed(attributes, "key")[0];
	if (key) {
		const raw = childText(key, "fifths") ?? "0";
		if (applies("key", raw)) {
			const fifths = Number(raw);
			if (
				raw !== "" &&
				Number.isInteger(fifths) &&
				fifths >= -7 &&
				fifths <= 7
			) {
				reader.settings.fifths = fifths;
			} else {
				warnings.add("Armure non prise en charge ignorée");
			}
		}
	}
	const time = childrenNamed(attributes, "time")[0];
	if (time) {
		const beats = childText(time, "beats");
		const beatType = childText(time, "beat-type");
		if (applies("time", `${beats}/${beatType}`)) {
			const found = TIME_SIGNATURES.find(
				(t) => `${t.beats}/${t.beatType}` === `${beats}/${beatType}`,
			);
			if (found) {
				reader.settings.time = found;
			} else {
				warnings.add("Chiffrage non pris en charge ignoré");
			}
		}
	}
	reader.locked ||= reader.seen.size > 0;
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
	const reader: SettingsReader = {
		settings: { ...DEFAULT_SETTINGS },
		seen: new Map(),
		locked: false,
	};
	for (const measure of childrenNamed(parts[0], "measure")) {
		for (const child of measure.children) {
			if (child.localName === "attributes") {
				divisions = readAttributes(child, reader, warnings, divisions);
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
	return { score, settings: reader.settings, warnings: [...warnings] };
}
