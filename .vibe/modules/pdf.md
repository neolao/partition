# Module: pdf

**Role:** Génère le PDF A4 portrait vectoriel de la partition : regroupe les mesures en lignes (jamais coupées), répartit les lignes sur les pages, dessine chaque ligne avec svg2pdf.js dans jsPDF et embarque la police musicale.
**Files:** `src/pdf.ts`, `src/fonts/bravura-subset.ttf`
**Exports:** `buildPdf(score, settings): Promise<Blob>`, `splitIntoLines`, `paginateLines`, `GLYPH_FONT_FAMILY`, `PageLayout`, `LineSlot`
**Depends on:** `modules/score.md`, `modules/staff.md`, `jspdf` et `svg2pdf.js` (décisions 001 et 003)
