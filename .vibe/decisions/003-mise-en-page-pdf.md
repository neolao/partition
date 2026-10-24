---
date: 2026-10-24
status: accepted
---
# Mise en page du PDF par lignes de mesures

**Context:** Item 005 : export PDF A4 d'une partition longue sans couper de mesure, avec svg2pdf.js + jsPDF (décision 001).
**Decision:** Un module dédié produit le PDF. Les mesures sont regroupées en lignes (« systèmes ») en réutilisant le rendu SVG existant sur des sous-partitions démarrant à une frontière de mesure ; une ligne reçoit une mesure de plus tant que le rendu tient dans la largeur cible. Le placement des lignes sur les pages A4 est une fonction pure testable ; le dessin passe par svg2pdf.js dans jsPDF. Le repère de sélection n'est pas imprimé ; les signalements de mesure incomplète ou trop remplie restent visibles.
**Reason:** Aucune modification du rendu éditeur, et une mesure n'est jamais coupée par construction.
**Rejected alternatives:** modifier le rendu de l'éditeur pour qu'il découpe en lignes (risque pour les clics et les tests existants) ; impression navigateur (maîtrise de la pagination insuffisante, décision 001).
