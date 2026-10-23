import { Renderer, Stave } from "vexflow";

export const MIN_STAFF_WIDTH = 200;
const STAFF_HEIGHT = 140;
const MARGIN = 10;

/** Dessine une portée vide en SVG dans le conteneur, en remplaçant tout dessin précédent. */
export function renderEmptyStaff(container: HTMLElement, width: number): void {
	if (!Number.isFinite(width)) {
		throw new RangeError(`Largeur invalide : ${width}`);
	}
	const svgWidth = Math.max(MIN_STAFF_WIDTH, Math.floor(width));
	container.replaceChildren();
	const renderer = new Renderer(
		container as HTMLDivElement,
		Renderer.Backends.SVG,
	);
	renderer.resize(svgWidth, STAFF_HEIGHT);
	const stave = new Stave(MARGIN, 20, svgWidth - 2 * MARGIN);
	stave.setContext(renderer.getContext()).draw();
}
