// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditor } from "../src/editor";
import { toMusicXml } from "../src/musicxml";
import { buildPdf } from "../src/pdf";
import { DEFAULT_SETTINGS } from "../src/score";

vi.mock("../src/musicxml", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../src/musicxml")>();
	return { ...actual, toMusicXml: vi.fn(actual.toMusicXml) };
});

vi.mock("../src/pdf", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../src/pdf")>();
	return { ...actual, buildPdf: vi.fn(actual.buildPdf) };
});

// Portée rendue : lignes à y = 60, 70, 80, 90, 100 (mi4 en bas, fa5 en haut).
const Y_SOL4 = 90;
const Y_MI4 = 100;
const Y_DO6 = 40;

let root: HTMLElement;
let staff: HTMLElement;

beforeEach(() => {
	document.body.replaceChildren();
	root = document.createElement("div");
	document.body.append(root);
	createEditor(root);
	staff = root.querySelector<HTMLElement>(".staff") as HTMLElement;
	// jsdom n'a pas de mise en page : la portée est placée à l'origine de la page.
	staff.getBoundingClientRect = () => new DOMRect(0, 0, 600, 140);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

function clickAt(x: number, y: number): void {
	staff.dispatchEvent(
		new MouseEvent("click", { clientX: x, clientY: y, bubbles: true }),
	);
}

function press(key: string): KeyboardEvent {
	const event = new KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
	});
	staff.dispatchEvent(event);
	return event;
}

function choose(selector: string): void {
	root.querySelector<HTMLButtonElement>(selector)?.click();
}

const announcement = () => root.querySelector("[aria-live]")?.textContent;
const noteGroups = () => [...staff.querySelectorAll(".vf-stavenote")];
const selectedGroups = () =>
	noteGroups().filter((g) => g.getAttribute("stroke-width") === "2");
const headYs = () =>
	[...staff.querySelectorAll(".vf-notehead text")].map((t) =>
		Number(t.getAttribute("y")),
	);
const hint = () => root.querySelector<HTMLElement>(".hint");

describe("createEditor : outils", () => {
	it("rend la portée focalisable au clavier", () => {
		expect(staff.getAttribute("tabindex")).toBe("0");
	});

	it("présente cinq durées avec la noire sélectionnée par défaut", () => {
		const buttons = [...root.querySelectorAll("[data-duration]")];
		expect(buttons.map((b) => b.textContent)).toEqual([
			"Ronde",
			"Blanche",
			"Noire",
			"Croche",
			"Double croche",
		]);
		const pressed = buttons.filter(
			(b) => b.getAttribute("aria-pressed") === "true",
		);
		expect(pressed.map((b) => b.textContent)).toEqual(["Noire"]);
	});

	it("ne garde qu'une durée enfoncée à la fois", () => {
		choose('[data-duration="8"]');
		const pressed = [...root.querySelectorAll("[data-duration]")].filter(
			(b) => b.getAttribute("aria-pressed") === "true",
		);
		expect(pressed.map((b) => b.textContent)).toEqual(["Croche"]);
	});

	it("bascule entre les modes Note et Silence", () => {
		expect(
			root.querySelector('[data-mode="note"]')?.getAttribute("aria-pressed"),
		).toBe("true");
		choose('[data-mode="rest"]');
		expect(
			root.querySelector('[data-mode="note"]')?.getAttribute("aria-pressed"),
		).toBe("false");
		expect(
			root.querySelector('[data-mode="rest"]')?.getAttribute("aria-pressed"),
		).toBe("true");
	});
});

describe("createEditor : pose d'éléments", () => {
	it("affiche l'invitation tant que la portée est vide", () => {
		expect(hint()?.hidden).toBe(false);
		expect(hint()?.textContent).toBe(
			"Choisissez une durée puis cliquez sur la portée",
		);
		clickAt(100, Y_SOL4);
		expect(hint()?.hidden).toBe(true);
	});

	it("pose une noire à la hauteur cliquée, la sélectionne et l'annonce", () => {
		clickAt(100, Y_SOL4);
		expect(noteGroups()).toHaveLength(1);
		expect(headYs()).toEqual([Y_SOL4]);
		expect(selectedGroups()).toHaveLength(1);
		expect(announcement()).toBe("Note sol4 noire ajoutée");
	});

	it("pose une note de la durée choisie", () => {
		choose('[data-duration="8"]');
		clickAt(100, Y_MI4);
		expect(announcement()).toBe("Note mi4 croche ajoutée");
	});

	it("pose un silence de la durée choisie en mode Silence", () => {
		choose('[data-duration="h"]');
		choose('[data-mode="rest"]');
		clickAt(100, Y_SOL4);
		expect(noteGroups()).toHaveLength(1);
		expect(announcement()).toBe("Silence blanche ajouté");
		expect(selectedGroups()).toHaveLength(1);
	});

	it("insère les éléments selon leur abscisse", () => {
		clickAt(300, Y_SOL4);
		clickAt(5, Y_MI4);
		expect(headYs()).toEqual([Y_MI4, Y_SOL4]);
	});

	it("ignore un clic hors de l'étendue utilisable", () => {
		clickAt(100, Y_DO6 - 30);
		clickAt(100, 139);
		expect(noteGroups()).toHaveLength(0);
		expect(announcement()).toBe("");
		expect(hint()?.hidden).toBe(false);
	});

	it("accepte un clic à la limite haute do6", () => {
		clickAt(100, Y_DO6);
		expect(announcement()).toBe("Note do6 noire ajoutée");
	});

	it("soustrait la position de la portée dans la page", () => {
		staff.getBoundingClientRect = () => new DOMRect(50, 30, 600, 140);
		clickAt(50 + 300, 30 + Y_SOL4);
		clickAt(50 + 5, 30 + Y_MI4);
		expect(headYs()).toEqual([Y_MI4, Y_SOL4]);
		expect(announcement()).toBe("Note mi4 noire ajoutée");
	});

	it("tient compte du défilement horizontal de la portée", () => {
		staff.scrollLeft = 0;
		clickAt(300, Y_SOL4);
		clickAt(5, Y_MI4);
		Object.defineProperty(staff, "scrollLeft", {
			value: 500,
			configurable: true,
		});
		clickAt(5, Y_SOL4);
		// 5 + 500 : à droite de tous les éléments, donc en dernier.
		expect(headYs()).toEqual([Y_MI4, Y_SOL4, Y_SOL4]);
		expect(selectedGroups()[0]).toBe(noteGroups()[2]);
	});
});

describe("createEditor : sélection", () => {
	function headX(index: number): number {
		const head = staff.querySelectorAll(".vf-notehead text")[index];
		return Number(head.getAttribute("x")) + 3;
	}

	it("sélectionne un élément existant au clic sans en poser un nouveau", () => {
		clickAt(100, Y_SOL4);
		clickAt(300, Y_MI4);
		// la première note est maintenant désélectionnée au profit de la seconde
		clickAt(headX(0), Y_SOL4);
		expect(noteGroups()).toHaveLength(2);
		expect(selectedGroups()).toHaveLength(1);
		expect(selectedGroups()[0]).toBe(noteGroups()[0]);
	});

	it("sélectionne un silence existant au clic sans en poser un nouveau", () => {
		choose('[data-mode="rest"]');
		clickAt(100, Y_SOL4);
		const mark = staff.querySelector("rect.selection-mark");
		const centerX =
			Number(mark?.getAttribute("x")) + Number(mark?.getAttribute("width")) / 2;
		press("Escape");
		expect(selectedGroups()).toHaveLength(0);
		// y = 65 est à 15 px du milieu de la portée (80), soit moins de 2 interlignes
		clickAt(centerX, 65);
		expect(noteGroups()).toHaveLength(1);
		expect(selectedGroups()).toHaveLength(1);
	});

	it("pose une nouvelle note si le clic est à l'abscisse d'une note mais trop loin de sa hauteur", () => {
		clickAt(100, Y_SOL4);
		clickAt(headX(0), Y_SOL4 - 30);
		expect(noteGroups()).toHaveLength(2);
		expect(headYs()).toHaveLength(2);
		expect(announcement()).toBe("Note fa5 noire ajoutée");
	});

	it("désélectionne avec Échap", () => {
		clickAt(100, Y_SOL4);
		press("Escape");
		expect(selectedGroups()).toHaveLength(0);
		expect(noteGroups()).toHaveLength(1);
	});
});

describe("createEditor : hauteur au clavier", () => {
	it("monte sol4 en la4 avec la flèche haut et l'annonce", () => {
		clickAt(100, Y_SOL4);
		const event = press("ArrowUp");
		expect(event.defaultPrevented).toBe(true);
		expect(headYs()).toEqual([85]);
		expect(announcement()).toBe("Note déplacée en la4");
	});

	it("descend sol4 en fa4 avec la flèche bas", () => {
		clickAt(100, Y_SOL4);
		const event = press("ArrowDown");
		expect(event.defaultPrevented).toBe(true);
		expect(headYs()).toEqual([95]);
		expect(announcement()).toBe("Note déplacée en fa4");
	});

	it("laisse la touche au navigateur quand rien n'est sélectionné", () => {
		clickAt(100, Y_SOL4);
		press("Escape");
		const event = press("ArrowUp");
		expect(event.defaultPrevented).toBe(false);
		expect(headYs()).toEqual([Y_SOL4]);
	});

	it("laisse la touche au navigateur quand un silence est sélectionné", () => {
		choose('[data-mode="rest"]');
		clickAt(100, Y_SOL4);
		const before = announcement();
		const event = press("ArrowUp");
		expect(event.defaultPrevented).toBe(false);
		expect(announcement()).toBe(before);
	});

	it("ne dépasse pas do7, borne haute de l'étendue", () => {
		clickAt(100, Y_DO6);
		for (let i = 0; i < 7; i++) {
			press("ArrowUp");
		}
		// do6 + 7 degrés = do7, dessiné 7 × 5 px au-dessus de do6 (y = 40 - 35)
		expect(announcement()).toBe("Note déplacée en do7");
		expect(headYs()).toEqual([5]);
		const event = press("ArrowUp");
		expect(event.defaultPrevented).toBe(true);
		expect(headYs()).toEqual([5]);
		expect(announcement()).toBe("Note déplacée en do7");
	});
});

describe("createEditor : suppression", () => {
	it("supprime l'élément sélectionné avec Suppr et sélectionne son voisin", () => {
		clickAt(100, Y_SOL4);
		clickAt(300, Y_MI4);
		clickAt(500, Y_DO6);
		const head = staff.querySelectorAll(".vf-notehead text")[1];
		clickAt(Number(head.getAttribute("x")) + 3, Y_MI4);
		const event = press("Delete");
		expect(event.defaultPrevented).toBe(true);
		expect(headYs()).toEqual([Y_SOL4, Y_DO6]);
		expect(announcement()).toBe("Élément supprimé");
		expect(selectedGroups()).toHaveLength(1);
		expect(selectedGroups()[0]).toBe(noteGroups()[1]);
	});

	it("supprime aussi avec Retour arrière", () => {
		clickAt(100, Y_SOL4);
		clickAt(300, Y_MI4);
		press("Backspace");
		expect(headYs()).toEqual([Y_SOL4]);
		expect(selectedGroups()[0]).toBe(noteGroups()[0]);
	});

	it("réaffiche l'invitation quand la dernière note est supprimée", () => {
		clickAt(100, Y_SOL4);
		press("Delete");
		expect(noteGroups()).toHaveLength(0);
		expect(hint()?.hidden).toBe(false);
	});

	it("laisse la touche au navigateur quand rien n'est sélectionné", () => {
		const event = press("Delete");
		expect(event.defaultPrevented).toBe(false);
		expect(announcement()).toBe("");
	});
});

describe("createEditor : export MusicXML", () => {
	function stubDownload() {
		const blobs: Blob[] = [];
		const revoked: string[] = [];
		const downloads: { name: string; href: string }[] = [];
		vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
			blobs.push(blob as Blob);
			return "blob:test";
		});
		vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
			revoked.push(url);
		});
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
			this: HTMLAnchorElement,
		) {
			downloads.push({ name: this.download, href: this.href });
		});
		return { blobs, revoked, downloads };
	}

	it("place le bouton hors des groupes à état pressé", () => {
		const button = root.querySelector<HTMLButtonElement>(
			'[data-action="export-musicxml"]',
		);
		expect(button?.textContent).toBe("Exporter MusicXML");
		expect(button?.hasAttribute("aria-pressed")).toBe(false);
	});

	it("télécharge partition.musicxml avec le contenu de la partition", async () => {
		vi.useFakeTimers();
		const { blobs, revoked, downloads } = stubDownload();
		clickAt(300, Y_SOL4);
		choose('[data-action="export-musicxml"]');
		expect(downloads).toEqual([
			{ name: "partition.musicxml", href: "blob:test" },
		]);
		expect(blobs[0].type).toBe("application/vnd.recordare.musicxml+xml");
		const text = await blobs[0].text();
		expect(text).toContain("<step>G</step>");
		expect(text).toContain("<type>quarter</type>");
		expect(revoked).toEqual([]);
		vi.runAllTimers();
		expect(revoked).toEqual(["blob:test"]);
		expect(announcement()).toBe("Partition exportée");
		expect(document.querySelector("a[download]")).toBeNull();
	});

	it("exporte une partition vide : mesure vide, un téléchargement, annonce", async () => {
		const { blobs, downloads } = stubDownload();
		choose('[data-action="export-musicxml"]');
		expect(downloads).toHaveLength(1);
		expect(blobs).toHaveLength(1);
		const text = await blobs[0].text();
		expect(text).toContain("<score-partwise");
		expect(text).toContain('<measure number="1">');
		expect(text).not.toContain("<note>");
		expect(announcement()).toBe("Partition exportée");
	});

	it("exporte une note et un silence lisibles par un parseur XML", async () => {
		const { blobs } = stubDownload();
		clickAt(100, Y_SOL4);
		choose('[data-mode="rest"]');
		choose('[data-duration="h"]');
		clickAt(300, Y_SOL4);
		choose('[data-action="export-musicxml"]');
		const doc = new DOMParser().parseFromString(
			await blobs[0].text(),
			"application/xml",
		);
		expect(doc.querySelector("parsererror")).toBeNull();
		const notes = [...doc.querySelectorAll("measure > note")];
		expect(notes).toHaveLength(2);
		expect(notes[0].querySelector("pitch > step")?.textContent).toBe("G");
		expect(notes[0].querySelector("pitch > octave")?.textContent).toBe("4");
		expect(notes[0].querySelector("duration")?.textContent).toBe("4");
		expect(notes[1].querySelector("rest")).not.toBeNull();
		expect(notes[1].querySelector("duration")?.textContent).toBe("8");
	});

	it("annonce l'échec sans exception quand la conversion lève", () => {
		const { downloads } = stubDownload();
		vi.mocked(toMusicXml).mockImplementationOnce(() => {
			throw new RangeError("Durée invalide : 32");
		});
		expect(() => choose('[data-action="export-musicxml"]')).not.toThrow();
		expect(announcement()).toBe("Échec de l'export : Durée invalide : 32");
		expect(downloads).toEqual([]);
	});

	it("nettoie le lien et l'URL quand le téléchargement lève", () => {
		vi.useFakeTimers();
		const { revoked } = stubDownload();
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
			throw new Error("téléchargement bloqué");
		});
		expect(() => choose('[data-action="export-musicxml"]')).not.toThrow();
		vi.runAllTimers();
		expect(announcement()).toBe("Échec de l'export : téléchargement bloqué");
		expect(document.querySelector("a[download]")).toBeNull();
		expect(revoked).toEqual(["blob:test"]);
	});
});

describe("createEditor : import MusicXML", () => {
	const VALID = `<score-partwise version="4.0"><part-list/><part id="P1"><measure number="1"><attributes><divisions>4</divisions></attributes>
		<note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
		<note><rest/><duration>8</duration><type>half</type></note></measure></part></score-partwise>`;
	const input = () =>
		root.querySelector<HTMLInputElement>(
			'input[type="file"]',
		) as HTMLInputElement;
	const notice = () =>
		root.querySelector<HTMLElement>(".notice") as HTMLElement;

	async function importText(text: string) {
		const live = root.querySelector("[aria-live]") as HTMLElement;
		live.textContent = "";
		const file = new File([text], "p.musicxml");
		Object.defineProperty(input(), "files", {
			value: [file],
			configurable: true,
		});
		input().dispatchEvent(new Event("change"));
		await vi.waitFor(() => expect(announcement()).not.toBe(""));
	}

	it("ouvre le sélecteur de fichier depuis le bouton Importer MusicXML", () => {
		const spy = vi.spyOn(input(), "click");
		const button = root.querySelector<HTMLButtonElement>(
			'[data-action="import-musicxml"]',
		);
		expect(button?.textContent).toBe("Importer MusicXML");
		button?.click();
		expect(spy).toHaveBeenCalledOnce();
	});

	it("affiche la partition importée sans avertissement", async () => {
		await importText(VALID);
		expect(announcement()).toBe("Partition importée");
		expect(noteGroups()).toHaveLength(2);
		expect(notice().hidden).toBe(true);
	});

	it("remplace la partition existante et efface la sélection", async () => {
		clickAt(100, Y_SOL4);
		expect(selectedGroups()).toHaveLength(1);
		await importText(VALID);
		expect(noteGroups()).toHaveLength(2);
		expect(selectedGroups()).toHaveLength(0);
	});

	it("liste les éléments non pris en charge", async () => {
		await importText(VALID.replace("</measure>", "<direction/></measure>"));
		expect(notice().hidden).toBe(false);
		expect(notice().getAttribute("role")).toBe("status");
		expect(notice().textContent).toContain("Élément « direction » ignoré");
	});

	it("affiche une erreur claire et garde la partition quand le fichier est invalide", async () => {
		clickAt(100, Y_SOL4);
		await importText("pas du xml");
		expect(notice().getAttribute("role")).toBe("alert");
		expect(notice().textContent).toContain("Échec de l'import");
		expect(noteGroups()).toHaveLength(1);
	});

	it("permet de réimporter le même fichier", async () => {
		const assigned: string[] = [];
		Object.defineProperty(input(), "value", {
			get: () => "nom-de-fichier",
			set: (value: string) => assigned.push(value),
			configurable: true,
		});
		await importText(VALID);
		expect(assigned).toEqual([""]);
	});

	it("garde les réglages quand l'import échoue", async () => {
		const clef = root.querySelector<HTMLSelectElement>(
			'select[data-setting="clef"]',
		) as HTMLSelectElement;
		clef.value = "bass";
		clef.dispatchEvent(new Event("change", { bubbles: true }));
		await importText("pas du xml");
		expect(clef.value).toBe("bass");
	});

	it("efface l'avertissement précédent après un import sans avertissement", async () => {
		await importText(VALID.replace("</measure>", "<direction/></measure>"));
		expect(notice().hidden).toBe(false);
		await importText(VALID);
		expect(notice().hidden).toBe(true);
	});
});

describe("createEditor : réglages", () => {
	const select = (name: string) =>
		root.querySelector<HTMLSelectElement>(
			`select[data-setting="${name}"]`,
		) as HTMLSelectElement;

	function change(name: string, value: string) {
		const element = select(name);
		element.focus();
		element.value = value;
		element.dispatchEvent(new Event("change", { bubbles: true }));
	}

	function addAt(x: number, y: number, count: number) {
		for (let i = 0; i < count; i++) {
			clickAt(x, y);
		}
	}

	it("présente trois listes avec un libellé visible et les valeurs par défaut", () => {
		const labels = ["clef", "fifths", "time"].map((name) => {
			const element = select(name);
			expect(element.labels).toHaveLength(1);
			return [
				element.labels?.[0].textContent?.trim().split("\n")[0],
				element.value,
			];
		});
		expect(labels.map(([label]) => label?.slice(0, 3))).toEqual([
			"Clé",
			"Arm",
			"Chi",
		]);
		expect(select("clef").value).toBe("treble");
		expect(select("fifths").value).toBe("0");
		expect(select("time").value).toBe("4/4");
	});

	it("propose les clés, 15 armures ordonnées et les chiffrages", () => {
		const texts = (name: string) =>
			[...select(name).options].map((o) => o.textContent);
		expect(texts("clef")).toEqual(["Sol", "Fa", "Ut"]);
		const fifths = texts("fifths");
		expect(fifths).toHaveLength(15);
		expect(fifths[0]).toBe("7 bémols");
		expect(fifths[7]).toBe("Do majeur");
		expect(fifths[14]).toBe("7 dièses");
		expect(texts("time")).toEqual([
			"2/4",
			"3/4",
			"4/4",
			"2/2",
			"3/8",
			"6/8",
			"9/8",
			"12/8",
		]);
	});

	it("place les listes après les boutons et avant l'export", () => {
		const children = [
			...(root.querySelector('[role="toolbar"]')?.children ?? []),
		];
		const indexOfSelect = children.findIndex((c) => c.querySelector("select"));
		const indexOfExport = children.findIndex(
			(c) => (c as HTMLElement).dataset.action === "export-musicxml",
		);
		const indexOfLastDuration = children.reduce(
			(last, c, i) => ((c as HTMLElement).dataset.duration ? i : last),
			-1,
		);
		expect(indexOfSelect).toBeGreaterThan(indexOfLastDuration);
		expect(indexOfSelect).toBeLessThan(indexOfExport);
	});

	it("redessine avec le nouveau chiffrage et annonce le nombre de mesures", () => {
		choose('[data-duration="8"]');
		addAt(5000, Y_SOL4, 7);
		expect(staff.querySelectorAll(".vf-stave")).toHaveLength(1);
		change("time", "6/8");
		expect(staff.querySelectorAll(".vf-stave")).toHaveLength(2);
		expect(announcement()).toBe("Chiffrage 6/8 : 2 mesures");
		expect(noteGroups()).toHaveLength(7);
		expect(document.activeElement).toBe(select("time"));
	});

	it("annonce « 1 mesure » au singulier", () => {
		change("fifths", "-3");
		expect(announcement()).toBe("Armure 3 bémols : 1 mesure");
	});

	it("annonce le changement de clé", () => {
		change("clef", "bass");
		expect(announcement()).toBe("Clé Fa : 1 mesure");
	});

	it("garde les notes quand la clé change", () => {
		addAt(5000, Y_SOL4, 2);
		change("clef", "alto");
		expect(noteGroups()).toHaveLength(2);
		expect(announcement()).toBe("Clé Ut : 1 mesure");
	});

	it("lit la hauteur cliquée selon la clé de fa : ligne du haut = la3", () => {
		change("clef", "bass");
		clickAt(100, 60);
		expect(announcement()).toMatch(/^Note la3 noire ajoutée/);
	});

	it("lit la hauteur cliquée selon la clé d'ut : ligne du haut = sol4", () => {
		change("clef", "alto");
		clickAt(100, 60);
		expect(announcement()).toMatch(/^Note sol4 noire ajoutée/);
	});

	it("sélectionne une note existante avec la hauteur de la clé courante", () => {
		change("clef", "bass");
		clickAt(100, 60);
		const head = staff.querySelector(".vf-notehead text");
		clickAt(Number(head?.getAttribute("x")) + 3, 60);
		expect(noteGroups()).toHaveLength(1);
	});

	it("ignore une valeur invalide sans rien changer", () => {
		const option = document.createElement("option");
		option.value = "99";
		select("fifths").append(option);
		change("fifths", "99");
		expect(announcement()).toBe("Réglage invalide");
		expect(select("fifths").value).toBe("0");
	});

	it("exporte avec les réglages choisis", () => {
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		change("clef", "bass");
		change("fifths", "2");
		change("time", "6/8");
		choose('[data-action="export-musicxml"]');
		expect(toMusicXml).toHaveBeenLastCalledWith([], {
			clef: "bass",
			fifths: 2,
			time: { beats: 6, beatType: 8 },
		});
	});

	it("exporte avec les réglages par défaut au départ", () => {
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		choose('[data-action="export-musicxml"]');
		expect(toMusicXml).toHaveBeenLastCalledWith([], DEFAULT_SETTINGS);
	});
});

describe("createEditor : état de la mesure", () => {
	it("signale une mesure complète après quatre noires en 4/4", () => {
		for (let i = 0; i < 3; i++) {
			clickAt(5000, Y_SOL4);
			expect(announcement()).toBe("Note sol4 noire ajoutée");
		}
		clickAt(5000, Y_SOL4);
		expect(announcement()).toBe("Note sol4 noire ajoutée. Mesure 1 complète");
	});

	it("signale une mesure trop remplie et numérote la mesure concernée", () => {
		for (let i = 0; i < 4; i++) {
			clickAt(5000, Y_SOL4);
		}
		for (let i = 0; i < 3; i++) {
			clickAt(5000, Y_SOL4);
		}
		choose('[data-duration="h"]');
		clickAt(5000, Y_SOL4);
		expect(announcement()).toBe(
			"Note sol4 blanche ajoutée. Mesure 2 trop remplie",
		);
	});

	it("complète aussi l'annonce d'un silence", () => {
		choose('[data-mode="rest"]');
		choose('[data-duration="w"]');
		clickAt(5000, Y_SOL4);
		expect(announcement()).toBe("Silence ronde ajouté. Mesure 1 complète");
	});
});

describe("createEditor : défilement vers la sélection", () => {
	it("fait défiler pour garder le centre de l'élément visible", () => {
		let left = 0;
		Object.defineProperty(staff, "clientWidth", {
			value: 30,
			configurable: true,
		});
		Object.defineProperty(staff, "scrollLeft", {
			get: () => left,
			set: (value: number) => {
				left = value;
			},
			configurable: true,
		});
		clickAt(5000, Y_SOL4);
		const mark = staff.querySelector("rect.selection-mark");
		const center =
			Number(mark?.getAttribute("x")) + Number(mark?.getAttribute("width")) / 2;
		expect(center).toBeGreaterThan(30);
		expect(left).toBe(center + 20 - 30);
	});
});

describe("createEditor : import des réglages", () => {
	const input = () =>
		root.querySelector<HTMLInputElement>(
			'input[type="file"]',
		) as HTMLInputElement;
	const FILE = `<score-partwise version="4.0"><part-list/><part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>-3</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time><clef><sign>F</sign><line>4</line></clef></attributes>
		<note><pitch><step>A</step><octave>3</octave></pitch><duration>4</duration><type>quarter</type></note></measure></part></score-partwise>`;

	it("applique la clé, l'armure et le chiffrage du fichier aux listes", async () => {
		Object.defineProperty(input(), "files", {
			value: [new File([FILE], "p.musicxml")],
			configurable: true,
		});
		input().dispatchEvent(new Event("change"));
		await vi.waitFor(() => expect(announcement()).toBe("Partition importée"));
		const value = (name: string) =>
			(
				root.querySelector(
					`select[data-setting="${name}"]`,
				) as HTMLSelectElement
			).value;
		expect(value("clef")).toBe("bass");
		expect(value("fifths")).toBe("-3");
		expect(value("time")).toBe("3/4");
		expect(headYs()).toEqual([60]);
	});
});

describe("createEditor : export PDF", () => {
	const EXPORT = '[data-action="export-pdf"]';

	function stubDownload() {
		const revoked: string[] = [];
		const downloads: { name: string; href: string }[] = [];
		const blobs: Blob[] = [];
		vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
			blobs.push(blob as Blob);
			return "blob:pdf";
		});
		vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
			revoked.push(url);
		});
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
			this: HTMLAnchorElement,
		) {
			downloads.push({ name: this.download, href: this.href });
		});
		return { downloads, revoked, blobs };
	}

	beforeEach(() => {
		// jsdom ne mesure pas les textes SVG : svg2pdf en a besoin pour les lire.
		Object.defineProperty(SVGElement.prototype, "getBBox", {
			configurable: true,
			value: () => ({ x: 0, y: 0, width: 10, height: 10 }),
		});
	});

	it("place un bouton « Exporter PDF » hors des groupes à état pressé", () => {
		const button = root.querySelector<HTMLButtonElement>(EXPORT);
		expect(button?.textContent).toBe("Exporter PDF");
		expect(button?.hasAttribute("aria-pressed")).toBe(false);
	});

	it("télécharge partition.pdf contenant un PDF et l'annonce", async () => {
		const { downloads, blobs, revoked } = stubDownload();
		clickAt(300, Y_SOL4);
		choose(EXPORT);
		await vi.waitFor(() => expect(downloads).toHaveLength(1));
		expect(downloads[0]).toEqual({ name: "partition.pdf", href: "blob:pdf" });
		expect((await blobs[0].text()).startsWith("%PDF")).toBe(true);
		expect(announcement()).toBe("partition.pdf téléchargé");
		await vi.waitFor(() => expect(revoked).toEqual(["blob:pdf"]));
		expect(document.querySelector("a[download]")).toBeNull();
	});

	it("exporte la partition et ses réglages sans toucher à l'affichage", async () => {
		stubDownload();
		clickAt(300, Y_SOL4);
		const before = staff.innerHTML;
		choose(EXPORT);
		await vi.waitFor(() =>
			expect(announcement()).toBe("partition.pdf téléchargé"),
		);
		expect(buildPdf).toHaveBeenCalledWith(
			[{ kind: "note", pitch: { step: "g", octave: 4 }, duration: "q" }],
			DEFAULT_SETTINGS,
		);
		expect(staff.innerHTML).toBe(before);
		expect(staff.querySelector(".selection-mark")).not.toBeNull();
	});

	it("n'exporte rien et explique pourquoi pour une partition vide", async () => {
		const { downloads } = stubDownload();
		choose(EXPORT);
		expect(announcement()).toBe(
			"Partition vide : ajoutez au moins une note avant d'exporter en PDF.",
		);
		expect(downloads).toEqual([]);
		expect(buildPdf).not.toHaveBeenCalled();
	});

	it("ré-annonce un message identique en vidant d'abord la zone d'annonces", () => {
		stubDownload();
		const live = root.querySelector("[aria-live]") as HTMLElement;
		const writes: string[] = [];
		let current = "";
		Object.defineProperty(live, "textContent", {
			get: () => current,
			set: (value: string) => {
				writes.push(value);
				current = value;
			},
		});
		choose(EXPORT);
		choose(EXPORT);
		expect(writes).toEqual([
			"",
			"Partition vide : ajoutez au moins une note avant d'exporter en PDF.",
			"",
			"Partition vide : ajoutez au moins une note avant d'exporter en PDF.",
		]);
	});

	it("annonce l'échec de génération sans téléchargement ni dessin résiduel", async () => {
		const { downloads } = stubDownload();
		clickAt(300, Y_SOL4);
		vi.mocked(buildPdf).mockRejectedValueOnce(new Error("mémoire"));
		choose(EXPORT);
		await vi.waitFor(() =>
			expect(announcement()).toBe(
				"Échec de l'export PDF. Réessayez ; si le problème persiste, utilisez Exporter MusicXML.",
			),
		);
		expect(downloads).toEqual([]);
	});

	it("ignore les clics répétés pendant l'export et signale l'occupation", async () => {
		const { downloads } = stubDownload();
		clickAt(300, Y_SOL4);
		let release: (blob: Blob) => void = () => {};
		vi.mocked(buildPdf).mockImplementationOnce(
			() => new Promise<Blob>((resolve) => (release = resolve)),
		);
		const button = root.querySelector<HTMLButtonElement>(
			EXPORT,
		) as HTMLButtonElement;
		button.click();
		button.click();
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.getAttribute("aria-disabled")).toBe("true");
		expect(button.disabled).toBe(false);
		release(new Blob(["%PDF"], { type: "application/pdf" }));
		await vi.waitFor(() => expect(downloads).toHaveLength(1));
		expect(buildPdf).toHaveBeenCalledTimes(1);
		expect(button.hasAttribute("aria-busy")).toBe(false);
		expect(button.hasAttribute("aria-disabled")).toBe(false);
	});

	it("libère le bouton après un échec", async () => {
		stubDownload();
		clickAt(300, Y_SOL4);
		vi.mocked(buildPdf).mockRejectedValueOnce(new Error("x"));
		const button = root.querySelector<HTMLButtonElement>(
			EXPORT,
		) as HTMLButtonElement;
		button.click();
		await vi.waitFor(() => expect(announcement()).toContain("Échec"));
		expect(button.hasAttribute("aria-busy")).toBe(false);
	});
});
