# Ubiquitous Language

## Portée
Ensemble de cinq lignes en clé de sol sur lequel se posent les notes et les silences. Une seule portée est affichée.
_Sources: `src/staff.ts`_

## Note
Élément de la partition défini par une hauteur (nom et octave) et une durée.
**Do not confuse with:** Silence
_Sources: `src/score.ts`_

## Silence
Élément de la partition qui a une durée mais pas de hauteur.
**Do not confuse with:** Note
_Sources: `src/score.ts`_

## Durée
Valeur d'un élément : ronde, blanche, noire, croche ou double croche.
_Sources: `src/score.ts`_

## Sélection
Élément actuellement choisi, que les flèches déplacent et que Suppr supprime.
_Sources: `src/editor.ts`_

## Export MusicXML
Téléchargement de la partition sous forme de fichier MusicXML (`partition.musicxml`), format standard lisible par d'autres logiciels de notation.
_Sources: `src/musicxml.ts`, `src/editor.ts`_
