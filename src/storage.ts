import { fromMusicXml, toMusicXml } from "./musicxml";
import type { Score, Settings } from "./score";

// Clé unique : score et réglages sont sauvegardés ensemble, au format MusicXML.
const STORAGE_KEY = "partition:score";

/** La donnée sauvegardée existe mais n'est pas un MusicXML lisible. */
export class UnreadableSaveError extends Error {}

/** Sauvegarde score et réglages. Lève l'erreur du stockage s'il est plein ou refusé. */
export function saveScore(
	storage: Storage,
	score: Score,
	settings: Settings,
): void {
	storage.setItem(STORAGE_KEY, toMusicXml(score, settings));
}

/**
 * Relit la sauvegarde, ou null s'il n'y en a pas.
 * Lève une UnreadableSaveError si elle est illisible ; une erreur du stockage lui-même remonte telle quelle.
 */
export function loadScore(
	storage: Storage,
): { score: Score; settings: Settings } | null {
	const xml = storage.getItem(STORAGE_KEY);
	if (xml === null) {
		return null;
	}
	try {
		const { score, settings } = fromMusicXml(xml);
		return { score, settings };
	} catch (error) {
		throw new UnreadableSaveError(
			error instanceof Error ? error.message : String(error),
		);
	}
}
