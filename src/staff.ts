import {
	Formatter,
	Renderer,
	Stave,
	StaveNote,
	type StaveNoteStruct,
	Voice,
} from "vexflow";
import {
	assertSettings,
	type Clef,
	DEFAULT_SETTINGS,
	fillName,
	type Measure,
	type Score,
	type ScoreElement,
	type Settings,
	splitMeasures,
	timeName,
} from "./score";

export const MIN_STAFF_WIDTH = 200;
const STAFF_HEIGHT = 165;
const MARGIN = 10;
const STAVE_TOP = 20;
const MIN_SPACE_PER_ELEMENT = 40;
// Largeur minimale (hors clé, armure et chiffrage) d'une mesure sans élément.
const EMPTY_MEASURE_WIDTH = 100;
// Demi-largeur approximative d'une tête de note, pour passer du bord gauche au centre.
const HEAD_HALF_WIDTH = 6;
// Repère non coloré sous l'élément sélectionné : distance sous la dernière ligne, taille.
const MARK_OFFSET = 15;
const MARK_WIDTH = 16;
const MARK_HEIGHT = 3;
const SELECTION_STYLE = {
	fillStyle: "#d33",
	strokeStyle: "#d33",
	lineWidth: 2,
};
// Texte de statut sous la mesure : distance sous la dernière ligne, taille, largeur approximative d'un caractère.
const STATUS_OFFSET = 42;
const STATUS_FONT_SIZE = 12;
const STATUS_CHAR_WIDTH = 7;
const STATUS_PADDING = 8;
const STATUS_COLORS = {
	overfull: "#b00020",
	"in-progress": "#555",
} as const;

// Nom VexFlow de la tonalité majeure correspondant au nombre d'altérations.
const MAJOR_KEYS: Record<number, string> = {
	0: "C",
	1: "G",
	2: "D",
	3: "A",
	4: "E",
	5: "B",
	6: "F#",
	7: "C#",
	"-1": "F",
	"-2": "Bb",
	"-3": "Eb",
	"-4": "Ab",
	"-5": "Db",
	"-6": "Gb",
	"-7": "Cb",
};

// Clé de silence au milieu de la portée selon la clé.
const REST_KEYS: Record<Clef, string> = {
	treble: "b/4",
	bass: "d/3",
	alto: "c/4",
};

export interface StaffGeometry {
	/** Ordonnée de la ligne du haut de la portée. */
	topLineY: number;
	/** Distance entre deux lignes de la portée. */
	lineSpacing: number;
	/** Abscisse du centre de chaque élément de la partition, dans l'ordre. */
	centers: number[];
	/** Mesures dessinées, dans l'ordre. */
	measures: Measure[];
}

function toStaveNote(element: ScoreElement, clef: Clef): StaveNote {
	const struct: StaveNoteStruct =
		element.kind === "note"
			? {
					keys: [`${element.pitch.step}/${element.pitch.octave}`],
					duration: element.duration,
					clef,
				}
			: { keys: [REST_KEYS[clef]], duration: `${element.duration}r`, clef };
	return new StaveNote(struct);
}

/** Texte et libellé de statut d'une mesure, ou null si rien à signaler. */
function statusLabel(
	measure: Measure,
	time: Settings["time"],
): { status: keyof typeof STATUS_COLORS; text: string } | null {
	const detail = `${fillName(measure.ticks)} sur ${timeName(time)}`;
	if (measure.status === "overfull") {
		return { status: "overfull", text: `▲ Trop remplie : ${detail}` };
	}
	if (measure.status === "incomplete") {
		// Seule la dernière mesure peut être incomplète : les autres se ferment une fois pleines.
		return { status: "in-progress", text: `… En cours : ${detail}` };
	}
	return null;
}

function svgOf(container: HTMLElement): SVGSVGElement | null {
	return container.querySelector("svg");
}

/** Ajoute sous l'élément sélectionné un trait qui le signale sans dépendre de la couleur. */
function drawSelectionMark(container: HTMLElement, centerX: number, y: number) {
	const svg = svgOf(container);
	if (!svg) {
		return;
	}
	const mark = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	mark.setAttribute("class", "selection-mark");
	mark.setAttribute("x", String(centerX - MARK_WIDTH / 2));
	mark.setAttribute("y", String(y));
	mark.setAttribute("width", String(MARK_WIDTH));
	mark.setAttribute("height", String(MARK_HEIGHT));
	mark.setAttribute("fill", SELECTION_STYLE.fillStyle);
	svg.append(mark);
}

/** Écrit sous la mesure son statut, en texte (donc sans dépendre de la couleur). */
function drawStatus(
	container: HTMLElement,
	label: { status: keyof typeof STATUS_COLORS; text: string },
	x: number,
	y: number,
) {
	const svg = svgOf(container);
	if (!svg) {
		return;
	}
	const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
	text.setAttribute("class", "measure-status");
	text.setAttribute("data-status", label.status);
	text.setAttribute("x", String(x));
	text.setAttribute("y", String(y));
	text.setAttribute("font-size", String(STATUS_FONT_SIZE));
	text.setAttribute("fill", STATUS_COLORS[label.status]);
	text.textContent = label.text;
	svg.append(text);
}

interface PlannedMeasure {
	measure: Measure;
	stave: Stave;
	notes: StaveNote[];
	voice: Voice | null;
	formatter: Formatter | null;
	label: ReturnType<typeof statusLabel>;
	/** Largeur minimale de la mesure entière, modificateurs compris. */
	minWidth: number;
	/** Largeur de la zone des notes : minimale, puis agrandie. */
	noteAreaWidth: number;
}

/** Dessine la partition en SVG dans le conteneur, une portée par mesure alignées sur une ligne, en remplaçant tout dessin précédent. */
export function renderStaff(
	container: HTMLElement,
	width: number,
	score: Score,
	selectedIndex: number | null,
	settings: Settings = DEFAULT_SETTINGS,
): StaffGeometry {
	if (!Number.isFinite(width)) {
		throw new RangeError(`Largeur invalide : ${width}`);
	}
	if (
		selectedIndex !== null &&
		(!Number.isInteger(selectedIndex) ||
			selectedIndex < 0 ||
			selectedIndex >= score.length)
	) {
		throw new RangeError(`Sélection invalide : ${selectedIndex}`);
	}
	assertSettings(settings);
	container.replaceChildren();
	const renderer = new Renderer(
		container as HTMLDivElement,
		Renderer.Backends.SVG,
	);
	const context = renderer.getContext();

	const allNotes = score.map((element) => toStaveNote(element, settings.clef));
	if (selectedIndex !== null) {
		allNotes[selectedIndex].setStyle(SELECTION_STYLE);
	}

	// Première passe : largeur minimale de chaque mesure.
	const measures = splitMeasures(score, settings.time);
	const planned: PlannedMeasure[] = measures.map((measure, i) => {
		const stave = new Stave(MARGIN, STAVE_TOP, EMPTY_MEASURE_WIDTH);
		if (i === 0) {
			stave
				.addClef(settings.clef)
				.addKeySignature(MAJOR_KEYS[settings.fifths])
				.addTimeSignature(timeName(settings.time));
		}
		const notes = allNotes.slice(measure.start, measure.end);
		const label = statusLabel(measure, settings.time);
		const modifiersWidth = stave.getNoteStartX() - MARGIN;
		let voice: Voice | null = null;
		let formatter: Formatter | null = null;
		let noteAreaWidth = EMPTY_MEASURE_WIDTH;
		if (notes.length > 0) {
			voice = new Voice({ numBeats: notes.length, beatValue: 4 })
				.setMode(Voice.Mode.SOFT)
				.addTickables(notes);
			formatter = new Formatter().joinVoices([voice]);
			noteAreaWidth =
				Math.max(
					formatter.preCalculateMinTotalWidth([voice]),
					notes.length * MIN_SPACE_PER_ELEMENT,
				) + MIN_SPACE_PER_ELEMENT;
		}
		const labelWidth = label
			? label.text.length * STATUS_CHAR_WIDTH + STATUS_PADDING
			: 0;
		return {
			measure,
			stave,
			notes,
			voice,
			formatter,
			label,
			minWidth: Math.max(modifiersWidth + noteAreaWidth, labelWidth),
			noteAreaWidth,
		};
	});

	const neededWidth =
		2 * MARGIN + planned.reduce((sum, p) => sum + p.minWidth, 0);
	const svgWidth = Math.max(MIN_STAFF_WIDTH, Math.floor(width), neededWidth);
	renderer.resize(svgWidth, STAFF_HEIGHT);
	// La place restante est répartie à parts égales entre les mesures.
	const extra = (svgWidth - neededWidth) / planned.length;

	// Seconde passe : mise en forme et dessin à la largeur définitive.
	let x = MARGIN;
	for (const p of planned) {
		const measureWidth = p.minWidth + extra;
		p.stave.setX(x);
		p.stave.setWidth(measureWidth);
		p.stave.setContext(context).draw();
		if (p.voice && p.formatter) {
			p.formatter.format(
				[p.voice],
				Math.max(p.noteAreaWidth - MIN_SPACE_PER_ELEMENT, 0) + extra,
			);
			p.voice.draw(context, p.stave);
		}
		x += measureWidth;
	}

	const first = planned[0].stave;
	const topLineY = first.getYForLine(0);
	const lineSpacing = first.getSpacingBetweenLines();
	const bottomLineY = first.getYForLine(4);
	const centers = allNotes.map((n) => n.getAbsoluteX() + HEAD_HALF_WIDTH);
	for (const p of planned) {
		if (p.label) {
			drawStatus(
				container,
				p.label,
				p.stave.getX() + STATUS_PADDING / 2,
				bottomLineY + STATUS_OFFSET,
			);
		}
	}
	if (selectedIndex !== null) {
		drawSelectionMark(
			container,
			centers[selectedIndex],
			bottomLineY + MARK_OFFSET,
		);
	}

	return { topLineY, lineSpacing, centers, measures };
}

/** Dessine une portée vide en SVG dans le conteneur, en remplaçant tout dessin précédent. */
export function renderEmptyStaff(container: HTMLElement, width: number): void {
	renderStaff(container, width, [], null);
}
