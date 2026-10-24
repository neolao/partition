import { fromMusicXml, toMusicXml } from "./musicxml";
import { buildPdf } from "./pdf";
import {
	assertSettings,
	CLEF_NAMES,
	CLEFS,
	type Clef,
	DEFAULT_SETTINGS,
	DURATION_NAMES,
	DURATIONS,
	type Duration,
	deleteElement,
	insertElement,
	insertionIndex,
	keySignatureName,
	movePitch,
	pitchFromY,
	pitchName,
	type Score,
	type Settings,
	TIME_SIGNATURES,
	timeName,
	yForPitch,
} from "./score";
import { renderStaff, type StaffGeometry } from "./staff";
import { loadScore, saveScore, UnreadableSaveError } from "./storage";

type Mode = "note" | "rest";

// Tolérance, en pixels, pour considérer qu'un clic vise un élément existant.
const HIT_X = 10;
const HIT_Y = 8;
// Un silence se dessine au milieu de la portée : on accepte tout clic à moins de 2 interlignes.
const REST_HIT_LINES = 2;

// Marge, en pixels, gardée visible autour de l'élément sélectionné lors du défilement.
const SCROLL_MARGIN = 20;
const FIFTHS_RANGE = Array.from({ length: 15 }, (_, i) => i - 7);

type SettingName = "clef" | "fifths" | "time";

const STORAGE_WARNING =
	"Sauvegarde automatique impossible : vos modifications seront perdues à la fermeture. Utilisez Exporter MusicXML pour les conserver.";

/** Le stockage local du navigateur, ou null si son simple accès est refusé. */
function browserStorage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

const capitalize = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1);

function createButton(label: string, data: Record<string, string>) {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	Object.assign(button.dataset, data);
	return button;
}

function createSetting(
	label: string,
	name: SettingName,
	options: { value: string; text: string }[],
) {
	const wrapper = document.createElement("label");
	wrapper.className = "setting";
	const text = document.createElement("span");
	text.textContent = label;
	const select = document.createElement("select");
	select.dataset.setting = name;
	select.append(
		...options.map(({ value, text: optionText }) => {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = optionText;
			return option;
		}),
	);
	wrapper.append(text, select);
	return { wrapper, select };
}

/**
 * Monte l'éditeur (palette, portée, aide, annonces) dans le conteneur.
 * La partition est sauvegardée dans `storage` après chaque modification et restaurée à l'ouverture.
 */
export function createEditor(
	root: HTMLElement,
	storage: Storage | null = browserStorage(),
): { redraw: () => void } {
	let score: Score = [];
	let selected: number | null = null;
	let duration: Duration = "q";
	let mode: Mode = "note";
	let geometry: StaffGeometry = {
		topLineY: 0,
		lineSpacing: 10,
		centers: [],
		measures: [],
	};
	let settings: Settings = DEFAULT_SETTINGS;

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
	const clefSetting = createSetting(
		"Clé",
		"clef",
		CLEFS.map((value) => ({ value, text: capitalize(CLEF_NAMES[value]) })),
	);
	const fifthsSetting = createSetting(
		"Armure",
		"fifths",
		FIFTHS_RANGE.map((value) => ({
			value: String(value),
			text: keySignatureName(value),
		})),
	);
	const timeSetting = createSetting(
		"Chiffrage",
		"time",
		TIME_SIGNATURES.map((value) => ({
			value: timeName(value),
			text: timeName(value),
		})),
	);
	const exportButton = createButton("Exporter MusicXML", {
		action: "export-musicxml",
	});
	const exportPdfButton = createButton("Exporter PDF", {
		action: "export-pdf",
	});
	const importButton = createButton("Importer MusicXML", {
		action: "import-musicxml",
	});
	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = ".musicxml,.xml,application/vnd.recordare.musicxml+xml";
	fileInput.hidden = true;
	toolbar.append(
		...modeButtons,
		...durationButtons,
		clefSetting.wrapper,
		fifthsSetting.wrapper,
		timeSetting.wrapper,
		exportButton,
		exportPdfButton,
		importButton,
		fileInput,
	);

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

	const notice = document.createElement("div");
	notice.className = "notice";
	notice.hidden = true;

	root.replaceChildren(toolbar, notice, staff, hint, live);

	// La zone partage deux sources : le dernier import (ou la sauvegarde illisible) et l'état du stockage.
	let importNotice: { role: "status" | "alert"; lines: string[] } = {
		role: "status",
		lines: [],
	};
	let storageFailed = false;
	let unreadableSaveShown = false;

	function renderNotice() {
		const lines = storageFailed
			? [...importNotice.lines, STORAGE_WARNING]
			: importNotice.lines;
		notice.setAttribute("role", storageFailed ? "alert" : importNotice.role);
		notice.replaceChildren(
			...lines.map((line) => {
				const paragraph = document.createElement("p");
				paragraph.textContent = line;
				return paragraph;
			}),
		);
		notice.hidden = lines.length === 0;
	}

	function showNotice(role: "status" | "alert", lines: string[]) {
		importNotice = { role, lines };
		unreadableSaveShown = false;
		renderNotice();
	}

	/** Sauvegarde automatique : avertit une fois par épisode d'échec, annonce le retour à la normale. */
	function persist() {
		if (storage === null) {
			return;
		}
		try {
			saveScore(storage, score, settings);
		} catch {
			if (!storageFailed) {
				storageFailed = true;
				renderNotice();
			}
			return;
		}
		if (unreadableSaveShown) {
			showNotice("status", []);
		}
		if (storageFailed) {
			storageFailed = false;
			renderNotice();
			live.textContent = `${live.textContent}. Sauvegarde automatique rétablie`;
		}
	}

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

	function syncSettings() {
		clefSetting.select.value = settings.clef;
		fifthsSetting.select.value = String(settings.fifths);
		timeSetting.select.value = timeName(settings.time);
	}

	function scrollToSelection() {
		// Sans mise en page (largeur nulle), il n'y a rien à faire défiler.
		if (selected === null || staff.clientWidth <= 0) {
			return;
		}
		const center = geometry.centers[selected];
		if (center - SCROLL_MARGIN < staff.scrollLeft) {
			staff.scrollLeft = center - SCROLL_MARGIN;
		} else if (center + SCROLL_MARGIN > staff.scrollLeft + staff.clientWidth) {
			staff.scrollLeft = center + SCROLL_MARGIN - staff.clientWidth;
		}
	}

	function redraw() {
		geometry = renderStaff(staff, staff.clientWidth, score, selected, settings);
		hint.hidden = score.length > 0;
		scrollToSelection();
	}

	function measureSuffix(index: number) {
		const measure = geometry.measures.find(
			({ start, end }) => index >= start && index < end,
		);
		if (measure?.status === "complete") {
			return `. Mesure ${geometry.measures.indexOf(measure) + 1} complète`;
		}
		if (measure?.status === "overfull") {
			return `. Mesure ${geometry.measures.indexOf(measure) + 1} trop remplie`;
		}
		return "";
	}

	function applySetting(name: SettingName, value: string) {
		const next: Settings = { ...settings };
		if (name === "clef") {
			next.clef = value as Clef;
		} else if (name === "fifths") {
			next.fifths = Number(value);
		} else {
			next.time =
				TIME_SIGNATURES.find((t) => timeName(t) === value) ?? next.time;
		}
		try {
			assertSettings(next);
		} catch {
			syncSettings();
			live.textContent = "Réglage invalide";
			return;
		}
		const label = {
			clef: `Clé ${capitalize(CLEF_NAMES[next.clef])}`,
			fifths: `Armure ${keySignatureName(next.fifths)}`,
			time: `Chiffrage ${timeName(next.time)}`,
		}[name];
		settings = next;
		redraw();
		const count = geometry.measures.length;
		live.textContent = `${label} : ${count} mesure${count > 1 ? "s" : ""}`;
		persist();
	}

	function update(
		next: Score,
		nextSelected: number | null,
		message: string,
		withMeasureState = false,
	) {
		score = next;
		selected = nextSelected;
		redraw();
		live.textContent =
			withMeasureState && nextSelected !== null
				? message + measureSuffix(nextSelected)
				: message;
		persist();
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
				Math.abs(
					y - yForPitch(element.pitch, topLineY, lineSpacing, settings.clef),
				) <= HIT_Y
			);
		});
		return index === -1 ? null : index;
	}

	function place(x: number, y: number) {
		const pitch = pitchFromY(
			y,
			geometry.topLineY,
			geometry.lineSpacing,
			settings.clef,
		);
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
				true,
			);
		} else {
			update(
				insertElement(score, { kind: "note", pitch, duration }, index),
				index,
				`Note ${pitchName(pitch)} ${durationName} ajoutée`,
				true,
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

	/** Télécharge le blob sous ce nom ; le lien temporaire et l'URL d'objet sont libérés même en cas d'échec. */
	function downloadBlob(blob: Blob, filename: string) {
		let url: string | null = null;
		let link: HTMLAnchorElement | null = null;
		try {
			url = URL.createObjectURL(blob);
			link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.append(link);
			link.click();
		} finally {
			link?.remove();
			if (url !== null) {
				const exportedUrl = url;
				setTimeout(() => URL.revokeObjectURL(exportedUrl), 0);
			}
		}
	}

	function exportMusicXml() {
		try {
			downloadBlob(
				new Blob([toMusicXml(score, settings)], {
					type: "application/vnd.recordare.musicxml+xml",
				}),
				"partition.musicxml",
			);
			live.textContent = "Partition exportée";
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			live.textContent = `Échec de l'export : ${message}`;
		}
	}

	// Vider la zone avant d'écrire fait ré-annoncer un message identique.
	function announce(message: string) {
		live.textContent = "";
		live.textContent = message;
	}

	let exportingPdf = false;

	async function exportPdf() {
		if (exportingPdf) {
			return;
		}
		if (score.length === 0) {
			announce(
				"Partition vide : ajoutez au moins une note avant d'exporter en PDF.",
			);
			return;
		}
		exportingPdf = true;
		exportPdfButton.setAttribute("aria-busy", "true");
		exportPdfButton.setAttribute("aria-disabled", "true");
		try {
			downloadBlob(await buildPdf(score, settings), "partition.pdf");
			announce("partition.pdf téléchargé");
		} catch (error) {
			console.error("Export PDF échoué", error);
			announce(
				"Échec de l'export PDF. Réessayez ; si le problème persiste, utilisez Exporter MusicXML.",
			);
		} finally {
			exportingPdf = false;
			exportPdfButton.removeAttribute("aria-busy");
			exportPdfButton.removeAttribute("aria-disabled");
		}
	}

	async function importMusicXml(file: File) {
		try {
			const {
				score: imported,
				settings: importedSettings,
				warnings,
			} = fromMusicXml(await file.text());
			const previousSettings = settings;
			settings = importedSettings;
			try {
				syncSettings();
				update(imported, null, "Partition importée");
			} catch (error) {
				settings = previousSettings;
				syncSettings();
				throw error;
			}
			showNotice(
				"status",
				warnings.length > 0
					? ["Partition importée. Éléments non pris en charge :", ...warnings]
					: [],
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			showNotice("alert", [`Échec de l'import : ${message}`]);
			live.textContent = `Échec de l'import : ${message}`;
		}
	}

	fileInput.addEventListener("change", () => {
		const file = fileInput.files?.[0];
		if (file) {
			void importMusicXml(file);
		}
		fileInput.value = "";
	});

	toolbar.addEventListener("click", (event) => {
		const button = (event.target as Element).closest("button");
		if (!button) {
			return;
		}
		if (button.dataset.action === "export-musicxml") {
			exportMusicXml();
			return;
		}
		if (button.dataset.action === "export-pdf") {
			void exportPdf();
			return;
		}
		if (button.dataset.action === "import-musicxml") {
			fileInput.click();
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

	toolbar.addEventListener("change", (event) => {
		const target = event.target as HTMLSelectElement;
		const name = target.dataset.setting as SettingName | undefined;
		if (name) {
			applySetting(name, target.value);
		}
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

	function restore(source: Storage) {
		try {
			const saved = loadScore(source);
			if (saved !== null) {
				({ score, settings } = saved);
				live.textContent = "Partition restaurée";
			}
		} catch (error) {
			if (error instanceof UnreadableSaveError) {
				showNotice("alert", [
					"La sauvegarde précédente est illisible ; elle sera remplacée à la première modification.",
				]);
				unreadableSaveShown = true;
			} else {
				storageFailed = true;
				renderNotice();
			}
		}
	}

	if (storage === null) {
		storageFailed = true;
		renderNotice();
	} else {
		restore(storage);
	}
	refreshToolbar();
	syncSettings();
	redraw();
	return { redraw };
}
