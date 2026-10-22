---

status: todo
depends_on: [006]
---

# Importer du MusicXML

## Description

Ouvrir un fichier MusicXML pour l'afficher et le modifier dans l'éditeur.

## Acceptance Criteria

- [ ] L'utilisateur choisit un fichier `.musicxml` et la partition s'affiche.
- [ ] Un fichier exporté par l'item 006 est réimporté à l'identique (notes, silences, durées).
- [ ] Un fichier invalide ou non pris en charge affiche une erreur claire sans casser l'éditeur.
- [ ] Les éléments MusicXML non pris en charge sont signalés à l'utilisateur.

## Notes

Le périmètre MusicXML pris en charge se limite à ce que l'éditeur sait représenter.
