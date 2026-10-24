/** Lit la table cmap (formats 4 et 12) d'un fichier TrueType et renvoie les points de code couverts. */
export function readCmapCodePoints(data: Uint8Array): Set<number> {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const tag = (offset: number) =>
		String.fromCharCode(...data.subarray(offset, offset + 4));
	const tableCount = view.getUint16(4);
	let cmap = -1;
	for (let i = 0; i < tableCount; i++) {
		const entry = 12 + i * 16;
		if (tag(entry) === "cmap") {
			cmap = view.getUint32(entry + 8);
		}
	}
	if (cmap < 0) {
		throw new Error("Table cmap absente");
	}
	const codePoints = new Set<number>();
	const subtableCount = view.getUint16(cmap + 2);
	for (let i = 0; i < subtableCount; i++) {
		const start = cmap + view.getUint32(cmap + 4 + i * 8 + 4);
		const format = view.getUint16(start);
		if (format === 4) {
			const segCount = view.getUint16(start + 6) / 2;
			const endCodes = start + 14;
			const startCodes = endCodes + segCount * 2 + 2;
			const idDeltas = startCodes + segCount * 2;
			const idRangeOffsets = idDeltas + segCount * 2;
			for (let s = 0; s < segCount; s++) {
				const first = view.getUint16(startCodes + s * 2);
				const last = view.getUint16(endCodes + s * 2);
				const delta = view.getUint16(idDeltas + s * 2);
				const rangeOffset = view.getUint16(idRangeOffsets + s * 2);
				for (let c = first; c <= last && c !== 0xffff; c++) {
					let glyph: number;
					if (rangeOffset === 0) {
						glyph = (c + delta) & 0xffff;
					} else {
						const address =
							idRangeOffsets + s * 2 + rangeOffset + (c - first) * 2;
						const raw = view.getUint16(address);
						glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
					}
					// L'index 0 est .notdef : le point de code n'a pas de vrai glyphe.
					if (glyph !== 0) {
						codePoints.add(c);
					}
				}
			}
		} else if (format === 12) {
			const groups = view.getUint32(start + 12);
			for (let g = 0; g < groups; g++) {
				const group = start + 16 + g * 12;
				const first = view.getUint32(group);
				const last = view.getUint32(group + 4);
				const firstGlyph = view.getUint32(group + 8);
				for (let c = first; c <= last; c++) {
					if (firstGlyph + (c - first) !== 0) {
						codePoints.add(c);
					}
				}
			}
		}
	}
	return codePoints;
}
