# Ubiquitous Language

## Portée
Ensemble de cinq lignes (clé de sol, de fa ou d'ut) sur lequel se posent les notes et les silences ; une portée est dessinée par mesure.
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

## Mesure
Groupe consécutif de notes et de silences dont la durée totale suit le chiffrage ; complète, trop remplie ou en cours (dernière mesure).
_Sources: `src/score.ts`_

## Réglages
Clé, armure et chiffrage de la partition.
_Sources: `src/score.ts`_

## Export PDF
Téléchargement de la partition sous forme de fichier PDF A4 (`partition.pdf`) : les mesures sont réparties en lignes puis en pages sans jamais être coupées ; une partition vide n'est pas exportée.
**Do not confuse with:** Export MusicXML
_Sources: `src/pdf.ts`, `src/editor.ts`_

## Sauvegarde automatique
Enregistrement de la partition et de ses réglages dans le navigateur après chaque modification, et restauration à la réouverture du site ; un avertissement signale un stockage indisponible ou une sauvegarde illisible.
**Do not confuse with:** Export MusicXML
_Sources: `src/storage.ts`, `src/editor.ts`_
