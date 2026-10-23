import {
	DURATIONS,
	type Duration,
	type Score,
	type ScoreElement,
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
