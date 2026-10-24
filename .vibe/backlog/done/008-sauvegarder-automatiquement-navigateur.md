---
status: done
depends_on: [003]
---

# Sauvegarder automatiquement dans le navigateur

## Description

Enregistrer la partition en cours dans le navigateur et la restaurer à la réouverture, pour ne pas perdre le travail.

## Acceptance Criteria

- [ ] Après une modification, la partition est sauvegardée sans action de l'utilisateur.
- [ ] À la réouverture du site, la dernière partition est restaurée.
- [ ] Si le stockage du navigateur est indisponible ou plein, l'utilisateur est prévenu et l'éditeur reste utilisable.

## Notes

Stockage local uniquement, aucun backend.
