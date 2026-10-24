---
date: 2026-10-24
status: accepted
---
# Réglages de partition et mesures dérivées

**Context:** Item 004 : clé, armure, chiffrage et répartition des notes en mesures.
**Decision:** La partition reste un tableau plat d'éléments ; les réglages (clé, armure, chiffrage) forment un objet séparé tenu par l'éditeur ; les mesures sont calculées à chaque rendu par une fonction pure (remplissage glouton, une note trop longue rend la mesure « trop remplie »). L'étendue des hauteurs est indépendante de la clé, seules les conversions hauteur ↔ position en dépendent.
**Reason:** Garde `centers` plat (clics et insertion inchangés), ne change pas la forme des tests existants, et les mesures dérivées n'ont rien à invalider quand le chiffrage change.
**Rejected alternatives:** enregistrement « document » regroupant réglages et éléments (migration de toutes les signatures, à reprendre quand 008/009 sérialiseront la partition) ; mesures stockées (donnée dérivée à invalider, réécriture de l'insertion et de la sélection).
