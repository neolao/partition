import { toMusicXml } from "./musicxml";
import {
	DURATION_NAMES,
	DURATIONS,
	type Duration,
	deleteElement,
	insertElement,
	insertionIndex,
	movePitch,
	pitchFromY,
	pitchName,
	type Score,
	yForPitch,
} from "./score";
import { renderStaff, type StaffGeometry } from "./staff";

type Mode = "note" | "rest";

// Tolérance, en pixels, pour considérer qu'un clic vise un élément existant.
const HIT_X = 10;
const HIT_Y = 8;
// Un silence se dessine au milieu de la portée : on accepte tout clic à moins de 2 interlignes.
const REST_HIT_LINES = 2;

const capitalize = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1);

function createButton(label: string, data: Record<string, string>) {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	Object.assign(button.dataset, data);
	return button;
}

/** Monte l'éditeur (palette, portée, aide, annonces) dans le conteneur. */
export function createEditor(root: HTMLElement): { redraw: () => void } {
	let score: Score = [];
	let selected: number | null = null;
	let duration: Duration = "q";
	let mode: Mode = "note";
	let geometry: StaffGeometry = { topLineY: 0, lineSpacing: 10, centers: [] };

	const toolbar = document.createElement("div");
	toolbar.setAttribute("role", "toolbar");
	toolbar.setAttribute("aria-label", "Outils de saisie");
	const durationButtons = DURATIONS.map((value) =>
		createButton(capitalize(DURATION_NAMES[value]), { duration: value }),
	);
	const modeButtons = [
		createButton("Note", { mode: "note" }),
		createButton("Silence", { mode: "rest" }),
	];
	const exportButton = createButton("Exporter MusicXML", {
		action: "export-musicxml",
	});
	toolbar.append(...modeButtons, ...durationButtons, exportButton);

	const staff = document.createElement("div");
	staff.className = "staff";
	staff.tabIndex = 0;
	staff.setAttribute("role", "group");
	staff.setAttribute("aria-label", "Portée");

	const hint = document.createElement("p");
	hint.className = "hint";
	hint.textContent = "Choisissez une durée puis cliquez sur la portée";

	const live = document.createElement("div");
	live.setAttribute("role", "status");
	live.setAttribute("aria-live", "polite");
	live.className = "visually-hidden";

	root.replaceChildren(toolbar, staff, hint, live);

	function refreshToolbar() {
		for (const button of durationButtons) {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.duration === duration),
			);
		}
		for (const button of modeButtons) {
			button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
		}
	}

	function redraw() {
		geometry = renderStaff(staff, staff.clientWidth, score, selected);
		hint.hidden = score.length > 0;
	}

	function update(next: Score, nextSelected: number | null, message: string) {
		score = next;
		selected = nextSelected;
		live.textContent = message;
		redraw();
	}

	function hit(x: number, y: number): number | null {
		const { topLineY, lineSpacing, centers } = geometry;
		const index = score.findIndex((element, i) => {
			if (Math.abs(centers[i] - x) > HIT_X) {
				return false;
			}
			if (element.kind === "rest") {
				const middle = topLineY + 2 * lineSpacing;
				return Math.abs(y - middle) <= REST_HIT_LINES * lineSpacing;
			}
			return (
				Math.abs(y - yForPitch(element.pitch, topLineY, lineSpacing)) <= HIT_Y
			);
		});
		return index === -1 ? null : index;
	}

	function place(x: number, y: number) {
		const pitch = pitchFromY(y, geometry.topLineY, geometry.lineSpacing);
		if (pitch === null) {
			return;
		}
		const index = insertionIndex(geometry.centers, x);
		const durationName = DURATION_NAMES[duration];
		if (mode === "rest") {
			update(
				insertElement(score, { kind: "rest", duration }, index),
				index,
				`Silence ${durationName} ajouté`,
			);
		} else {
			update(
				insertElement(score, { kind: "note", pitch, duration }, index),
				index,
				`Note ${pitchName(pitch)} ${durationName} ajoutée`,
			);
		}
	}

	function moveSelected(delta: number) {
		if (selected === null) {
			return false;
		}
		const element = score[selected];
		if (element.kind !== "note") {
			return false;
		}
		const moved = movePitch(score, selected, delta);
		const note = moved[selected];
		if (moved !== score && note.kind === "note") {
			update(moved, selected, `Note déplacée en ${pitchName(note.pitch)}`);
		}
		return true;
	}

	function exportMusicXml() {
		let url: string | null = null;
		let link: HTMLAnchorElement | null = null;
		try {
			const blob = new Blob([toMusicXml(score)], {
				type: "application/vnd.recordare.musicxml+xml",
			});
			url = URL.createObjectURL(blob);
			link = document.createElement("a");
			link.href = url;
			link.download = "partition.musicxml";
			document.body.append(link);
			link.click();
			live.textContent = "Partition exportée";
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			live.textContent = `Échec de l'export : ${message}`;
		} finally {
			link?.remove();
			if (url !== null) {
				const exportedUrl = url;
				setTimeout(() => URL.revokeObjectURL(exportedUrl), 0);
			}
		}
	}

	toolbar.addEventListener("click", (event) => {
		const button = (event.target as Element).closest("button");
		if (!button) {
			return;
		}
		if (button.dataset.action === "export-musicxml") {
			exportMusicXml();
			return;
		}
		if (button.dataset.duration) {
			duration = button.dataset.duration as Duration;
		}
		if (button.dataset.mode) {
			mode = button.dataset.mode as Mode;
		}
		refreshToolbar();
	});

	staff.addEventListener("click", (event) => {
		const rect = staff.getBoundingClientRect();
		const x = event.clientX - rect.left + staff.scrollLeft;
		const y = event.clientY - rect.top;
		const index = hit(x, y);
		if (index !== null) {
			selected = index;
			redraw();
		} else {
			place(x, y);
		}
	});

	staff.addEventListener("keydown", (event) => {
		let handled = false;
		if (event.key === "ArrowUp") {
			handled = moveSelected(1);
		} else if (event.key === "ArrowDown") {
			handled = moveSelected(-1);
		} else if (
			(event.key === "Delete" || event.key === "Backspace") &&
			selected !== null
		) {
			const result = deleteElement(score, selected);
			update(result.score, result.selected, "Élément supprimé");
			handled = true;
		} else if (event.key === "Escape" && selected !== null) {
			selected = null;
			redraw();
			handled = true;
		}
		if (handled) {
			event.preventDefault();
		}
	});

	refreshToolbar();
	redraw();
	return { redraw };
}
