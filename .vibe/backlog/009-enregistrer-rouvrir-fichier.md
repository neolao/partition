---
status: blocked
depends_on: [006]
---

# Enregistrer et rouvrir un fichier de partition

## Description

Permettre d'enregistrer la partition dans un fichier sur l'ordinateur et de rouvrir ce fichier, pour sauvegarder et transférer son travail.

## Acceptance Criteria

- [ ] L'utilisateur enregistre la partition dans un fichier téléchargé.
- [ ] L'utilisateur rouvre ce fichier et retrouve la partition à l'identique.
- [ ] Un fichier illisible affiche une erreur claire sans perdre la partition en cours.

## Notes

Peut s'appuyer sur le format MusicXML de l'item 006. À arbitrer à l'implémentation si un format interne dédié est préférable.

## Blocked

2026-10-24 : doublon possible de 006 et 007 (export et import MusicXML déjà livrés : téléchargement, réimport à l'identique, erreur claire sans perte de la partition) ; à clôturer ou reformuler par le PO.
