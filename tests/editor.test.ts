// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createEditor } from "../src/editor";

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

	it("ne dépasse pas do6", () => {
		clickAt(100, Y_DO6);
		const event = press("ArrowUp");
		expect(event.defaultPrevented).toBe(true);
		expect(headYs()).toEqual([Y_DO6]);
		expect(announcement()).toBe("Note do6 noire ajoutée");
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
