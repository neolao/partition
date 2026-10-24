// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { toMusicXml } from "../src/musicxml";
import { DEFAULT_SETTINGS, type Score, type Settings } from "../src/score";
import { loadScore, saveScore, UnreadableSaveError } from "../src/storage";

const SCORE: Score = [
	{ kind: "note", pitch: { step: "g", octave: 4 }, duration: "q" },
	{ kind: "rest", duration: "h" },
];
const SETTINGS: Settings = {
	clef: "bass",
	fifths: -3,
	time: { beats: 3, beatType: 4 },
};

let storage: Storage;

beforeEach(() => {
	localStorage.clear();
	storage = localStorage;
});

describe("storage : sauvegarde et chargement", () => {
	it("restitue le score et les réglages sauvegardés", () => {
		saveScore(storage, SCORE, SETTINGS);
		expect(loadScore(storage)).toEqual({ score: SCORE, settings: SETTINGS });
	});

	it("stocke score et réglages ensemble dans une seule entrée MusicXML", () => {
		saveScore(storage, SCORE, SETTINGS);
		expect(storage.length).toBe(1);
		expect(storage.getItem(storage.key(0) as string)).toBe(
			toMusicXml(SCORE, SETTINGS),
		);
	});

	it("restitue une partition vide avec les réglages par défaut", () => {
		saveScore(storage, [], DEFAULT_SETTINGS);
		expect(loadScore(storage)).toEqual({
			score: [],
			settings: DEFAULT_SETTINGS,
		});
	});

	it("conserve les réglages d'une partition vide", () => {
		saveScore(storage, [], SETTINGS);
		expect(loadScore(storage)?.settings).toEqual(SETTINGS);
	});

	it("remplace la sauvegarde précédente", () => {
		saveScore(storage, SCORE, SETTINGS);
		saveScore(storage, [], DEFAULT_SETTINGS);
		expect(loadScore(storage)?.score).toEqual([]);
		expect(storage.length).toBe(1);
	});

	it("renvoie null quand rien n'a été sauvegardé", () => {
		expect(loadScore(storage)).toBeNull();
	});
});

describe("storage : erreurs", () => {
	it("lève UnreadableSaveError quand la donnée n'est pas du MusicXML", () => {
		saveScore(storage, SCORE, SETTINGS);
		storage.setItem(storage.key(0) as string, "pas du xml");
		expect(() => loadScore(storage)).toThrow(UnreadableSaveError);
	});

	it("laisse remonter l'erreur du stockage à l'écriture", () => {
		const full = {
			setItem: () => {
				throw new DOMException("plein", "QuotaExceededError");
			},
		} as unknown as Storage;
		expect(() => saveScore(full, SCORE, SETTINGS)).toThrow("plein");
	});

	it("laisse remonter l'erreur du stockage à la lecture sans la confondre avec une sauvegarde illisible", () => {
		const denied = {
			getItem: () => {
				throw new DOMException("refusé", "SecurityError");
			},
		} as unknown as Storage;
		expect(() => loadScore(denied)).toThrow("refusé");
		expect(() => loadScore(denied)).not.toThrow(UnreadableSaveError);
	});
});
