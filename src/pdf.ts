import {
	assertSettings,
	type Score,
	type Settings,
	splitMeasures,
} from "./score";
import { MIN_STAFF_WIDTH, renderStaff } from "./staff";

// Page A4 portrait, en points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 40;
// Largeur, en pixels, visée pour une ligne de mesures avant mise à l'échelle sur la page.
const TARGET_LINE_WIDTH = 700;

export interface PageLayout {
	pageHeight: number;
	margin: number;
	lineHeight: number;
}

export interface LineSlot {
	page: number;
	y: number;
}

/** Emplacement de chaque ligne : on remplit une page puis on passe à la suivante. */
export function paginateLines(
	lineCount: number,
	{ pageHeight, margin, lineHeight }: PageLayout,
): LineSlot[] {
	const usable = pageHeight - 2 * margin;
	if (lineHeight > usable) {
		throw new RangeError(`Ligne trop haute pour la page : ${lineHeight}`);
	}
	const perPage = Math.max(1, Math.floor(usable / lineHeight));
	return Array.from({ length: lineCount }, (_, i) => ({
		page: Math.floor(i / perPage),
		y: margin + (i % perPage) * lineHeight,
	}));
}

function svgWidthOf(container: HTMLElement): number {
	return Number(container.querySelector("svg")?.getAttribute("width"));
}

/** Regroupe les mesures en lignes (sous-partitions) : une ligne reçoit une mesure de plus tant que son rendu tient dans la largeur. */
export function splitIntoLines(
	score: Score,
	settings: Settings,
	width: number,
): Score[] {
	assertSettings(settings);
	const measures = splitMeasures(score, settings.time);
	const container = document.createElement("div");
	const limit = Math.max(MIN_STAFF_WIDTH, Math.floor(width));
	const fits = (from: number, to: number) => {
		const part = score.slice(measures[from].start, measures[to].end);
		renderStaff(container, width, part, null, settings);
		return svgWidthOf(container) <= limit;
	};
	const lines: Score[] = [];
	let first = 0;
	while (first < measures.length) {
		// Une mesure seule plus large que la ligne reste seule sur sa ligne.
		let last = first;
		while (last + 1 < measures.length && fits(first, last + 1)) {
			last++;
		}
		lines.push(score.slice(measures[first].start, measures[last].end));
		first = last + 1;
	}
	return lines;
}

/** Génère le PDF (A4 portrait, vectoriel) de la partition. */
export async function buildPdf(
	score: Score,
	settings: Settings,
): Promise<Blob> {
	if (score.length === 0) {
		throw new Error("Partition vide");
	}
	const lines = splitIntoLines(score, settings, TARGET_LINE_WIDTH);
	const { jsPDF } = await import("jspdf");
	const { svg2pdf } = await import("svg2pdf.js");
	const { default: fontDataUri } = await import(
		"./fonts/bravura-subset.ttf?inline"
	);
	// svg2pdf lit le style calculé : le dessin doit être dans le document, hors de l'écran.
	const hidden = document.createElement("div");
	hidden.setAttribute("aria-hidden", "true");
	hidden.style.cssText = "position:absolute;left:-100000px;top:0";
	document.body.append(hidden);
	try {
		const usableWidth = PAGE_WIDTH - 2 * PAGE_MARGIN;
		const drawings = lines.map((line) => {
			const container = document.createElement("div");
			hidden.append(container);
			renderStaff(container, TARGET_LINE_WIDTH, line, null, settings);
			const svg = container.querySelector("svg") as SVGSVGElement;
			// svg2pdf ignore les tailles en « pt » : on les convertit en pixels (1 pt = 4/3 px).
			for (const text of svg.querySelectorAll("text[font-size$='pt']")) {
				const points = Number.parseFloat(text.getAttribute("font-size") ?? "");
				text.setAttribute("font-size", String((points * 4) / 3));
			}
			// La police embarquée n'a que des glyphes musicaux : les libellés de mesure restent en police standard,
			// sans pictogramme hors WinAnsi (le texte seul porte déjà le statut).
			for (const label of svg.querySelectorAll("text.measure-status")) {
				label.setAttribute("font-family", "helvetica");
				label.textContent = (label.textContent ?? "")
					.replace("▲", "!")
					.replace("…", "...");
			}
			const width = Number(svg.getAttribute("width"));
			const height = Number(svg.getAttribute("height"));
			// Une ligne plus large que la cible est réduite pour tenir, jamais coupée.
			const scale = usableWidth / width;
			return { svg, width: width * scale, height: height * scale };
		});
		const lineHeight = Math.max(...drawings.map((d) => d.height));
		const slots = paginateLines(drawings.length, {
			pageHeight: PAGE_HEIGHT,
			margin: PAGE_MARGIN,
			lineHeight,
		});
		const pdf = new jsPDF({
			unit: "pt",
			format: "a4",
			orientation: "portrait",
		});
		// Les notes et la clé sont des glyphes de police : la police doit être embarquée dans le PDF.
		pdf.addFileToVFS(
			"Bravura.ttf",
			fontDataUri.slice(fontDataUri.indexOf(",") + 1),
		);
		pdf.addFont("Bravura.ttf", "Bravura", "normal");
		for (const [i, drawing] of drawings.entries()) {
			if (slots[i].page >= pdf.getNumberOfPages()) {
				pdf.addPage();
			}
			pdf.setPage(slots[i].page + 1);
			await svg2pdf(drawing.svg, pdf, {
				x: PAGE_MARGIN,
				y: slots[i].y,
				width: drawing.width,
				height: drawing.height,
			});
		}
		return pdf.output("blob");
	} finally {
		hidden.remove();
	}
}
