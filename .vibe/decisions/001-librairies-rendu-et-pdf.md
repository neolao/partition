---
date: 2026-10-23
status: proposed
---
# Librairies de rendu de partition et de génération PDF

**Context:** Comparaison demandée par l'item 001, avant les items d'éditeur et d'export. Versions relevées sur npm le 2026-10-23. Statut `proposed` : la décision revient au Product Owner.

**Rendu de partition — options comparées :**

| Option | Licence | Taille (paquet npm) | Rendu | MusicXML | Édition |
|---|---|---|---|---|---|
| VexFlow 5.0.0 | MIT | 21 Mo (polices incluses) | SVG ou canvas, qualité professionnelle | non (à écrire) | contrôle total : on dessine notes et mesures nous-mêmes |
| OpenSheetMusicDisplay 2.2.1 | BSD-3 | 2,3 Mo (≈ 400 Ko gzip une fois bundlé, VexFlow inclus) | SVG ou canvas, basé sur VexFlow | lecture oui, export non | affichage seulement : pas de modèle éditable |
| Verovio 6.3.0 | LGPL-3 | 27 Mo (WASM) | SVG, excellent | lecture oui, export MEI | affichage seulement ; LGPL contraignante pour un site statique |
| abcjs 6.7.2 | MIT | 6 Mo | SVG | non (notation ABC) | notation texte, hors du cadre MusicXML |

**PDF côté navigateur — approches comparées :**

| Approche | Qualité à l'impression | Remarque |
|---|---|---|
| SVG → PDF vectoriel (svg2pdf.js 2.8.1 + jsPDF 4.2.1, MIT) | vectorielle, nette à toute taille | testé, voir ci-dessous |
| Impression navigateur (`window.print()` + CSS d'impression) | vectorielle, rien à embarquer | l'utilisateur passe par la boîte de dialogue ; mise en page et pagination moins maîtrisées |
| Canvas → image dans le PDF | raster, flou si la résolution est faible | à écarter pour une partition |

**Prototype :** portée VexFlow (clé de sol, 4/4, quatre noires) rendue en SVG, convertie en PDF par svg2pdf.js/jsPDF, dans un build Vite statique identique à celui du projet. Vérifié dans Chrome : 1 SVG de 10 tracés, PDF de 5 341 octets produit, aucune erreur. Poids du bundle : ≈ 1,6 Mo (≈ 840 Ko gzip) pour le code principal, dont l'essentiel vient des polices de VexFlow ; jsPDF tire en plus html2canvas et DOMPurify en chargement différé (≈ 57 Ko gzip, inutiles pour du vectoriel). Le prototype est resté hors du dépôt : aucune dépendance ajoutée au projet.

**Decision (recommandation à valider) :** VexFlow pour le rendu et l'édition, svg2pdf.js + jsPDF pour l'export PDF vectoriel, import/export MusicXML écrits dans le projet à partir du modèle de la partition.

**Reason:** l'éditeur a besoin de contrôler chaque note à l'écran, ce que seul VexFlow permet ; OSMD et Verovio ne font qu'afficher et leur modèle n'est pas éditable. Licence MIT sans contrainte. Le PDF vectoriel donne la meilleure qualité d'impression et réutilise le SVG déjà affiché.

**Rejected alternatives:** OSMD (pas d'édition, pas d'export MusicXML) ; Verovio (LGPL, WASM lourd, affichage seul) ; abcjs (hors MusicXML) ; PDF par image (flou) ; impression navigateur seule (maîtrise insuffisante, à garder éventuellement en repli).

**Risques à connaître :** poids du bundle élevé (polices VexFlow) — à réduire plus tard en chargeant seulement la police utile ; l'import MusicXML est un vrai chantier à écrire (le parseur d'OSMD pourrait servir de référence).
