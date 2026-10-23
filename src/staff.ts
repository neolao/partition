import {
	Formatter,
	Renderer,
	Stave,
	StaveNote,
	type StaveNoteStruct,
	Voice,
} from "vexflow";
import type { Score, ScoreElement } from "./score";

export const MIN_STAFF_WIDTH = 200;
const STAFF_HEIGHT = 140;
const MARGIN = 10;
const STAVE_TOP = 20;
const MIN_SPACE_PER_ELEMENT = 40;
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

export interface StaffGeometry {
	/** Ordonnée de la ligne du haut de la portée. */
	topLineY: number;
	/** Distance entre deux lignes de la portée. */
	lineSpacing: number;
	/** Abscisse du centre de chaque élément de la partition. */
	centers: number[];
}

function toStaveNote(element: ScoreElement): StaveNote {
	const struct: StaveNoteStruct =
		element.kind === "note"
			? {
					keys: [`${element.pitch.step}/${element.pitch.octave}`],
					duration: element.duration,
				}
			: { keys: ["b/4"], duration: `${element.duration}r` };
	return new StaveNote(struct);
}

/** Ajoute sous l'élément sélectionné un trait qui le signale sans dépendre de la couleur. */
function drawSelectionMark(container: HTMLElement, centerX: number, y: number) {
	const svg = container.querySelector("svg");
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

/** Dessine la portée et la partition en SVG dans le conteneur, en remplaçant tout dessin précédent. */
export function renderStaff(
	container: HTMLElement,
	width: number,
	score: Score,
	selectedIndex: number | null,
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
	container.replaceChildren();
	const renderer = new Renderer(
		container as HTMLDivElement,
		Renderer.Backends.SVG,
	);
	const context = renderer.getContext();
	const stave = new Stave(MARGIN, STAVE_TOP, MIN_STAFF_WIDTH - 2 * MARGIN);
	stave.addClef("treble");

	const notes = score.map(toStaveNote);
	if (selectedIndex !== null) {
		notes[selectedIndex].setStyle(SELECTION_STYLE);
	}
	let noteAreaWidth = 0;
	let voice: Voice | null = null;
	if (notes.length > 0) {
		voice = new Voice({ numBeats: notes.length, beatValue: 4 })
			.setMode(Voice.Mode.SOFT)
			.addTickables(notes);
		const formatter = new Formatter().joinVoices([voice]);
		noteAreaWidth = Math.max(
			formatter.preCalculateMinTotalWidth([voice]),
			notes.length * MIN_SPACE_PER_ELEMENT,
		);
		formatter.format([voice], noteAreaWidth);
	}

	const neededWidth =
		stave.getNoteStartX() + noteAreaWidth + MIN_SPACE_PER_ELEMENT + MARGIN;
	const svgWidth = Math.max(MIN_STAFF_WIDTH, Math.floor(width), neededWidth);
	renderer.resize(svgWidth, STAFF_HEIGHT);
	stave.setWidth(svgWidth - 2 * MARGIN);
	stave.setContext(context).draw();
	voice?.draw(context, stave);

	const topLineY = stave.getYForLine(0);
	const lineSpacing = stave.getSpacingBetweenLines();
	const centers = notes.map((note) => note.getAbsoluteX() + HEAD_HALF_WIDTH);
	if (selectedIndex !== null) {
		drawSelectionMark(
			container,
			centers[selectedIndex],
			stave.getYForLine(4) + MARK_OFFSET,
		);
	}

	return { topLineY, lineSpacing, centers };
}

/** Dessine une portée vide en SVG dans le conteneur, en remplaçant tout dessin précédent. */
export function renderEmptyStaff(container: HTMLElement, width: number): void {
	renderStaff(container, width, [], null);
}
