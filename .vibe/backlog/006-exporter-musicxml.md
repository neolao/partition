---

status: todo
depends_on: [003]
---

# Exporter en MusicXML

## Description

Exporter la partition au format standard MusicXML pour l'ouvrir dans d'autres logiciels.

## Acceptance Criteria

- [ ] L'utilisateur télécharge un fichier `.musicxml` de la partition.
- [ ] Le fichier est un MusicXML valide, contenant notes, silences et durées.
- [ ] Le fichier s'ouvre dans un autre logiciel de notation avec la même musique.
- [ ] L'export d'une partition vide produit un document valide sans note.

## Notes

Le modèle de partition interne devra rester convertible sans perte vers MusicXML.
