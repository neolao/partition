---
date: 2026-10-24
status: accepted
---
# Sauvegarde automatique au format MusicXML dans localStorage

**Context:** Item 008 : restaurer la partition et ses réglages à la réouverture du site.
**Decision:** La partition et les réglages sont sérialisés en MusicXML (convertisseurs existants) et stockés dans une seule entrée localStorage, écrite de façon synchrone après chaque modification.
**Reason:** Réutilise un format déjà validé à la lecture, garantit que score et réglages ne se mélangent jamais, et évite un second format à maintenir.
**Rejected alternatives:** JSON propre à l'application (second format et sa validation à écrire) ; écriture différée (complexité inutile pour une si petite donnée).
