# partition

Site statique pour écrire une partition de musique dans le navigateur, générer un PDF à imprimer, et importer ou exporter la partition au format MusicXML.

<!-- vibe:begin:features -->

- Une portée s'affiche à l'ouverture et s'adapte à la largeur de la fenêtre.
- On choisit une durée (ronde à double croche), puis un clic sur la portée pose une note ou un silence.
- Les flèches haut et bas changent la hauteur de la note sélectionnée ; Suppr supprime l'élément sélectionné.
- Le bouton « Exporter MusicXML » télécharge la partition au format MusicXML, lisible par d'autres logiciels de notation.
- Le bouton « Exporter PDF » télécharge la partition en PDF A4 prêt à imprimer : les mesures ne sont jamais coupées entre deux lignes ou deux pages, et une partition vide affiche un message au lieu d'un PDF vide.
- Le bouton « Importer MusicXML » ouvre un fichier MusicXML pour l'afficher et le modifier ; un fichier invalide donne une erreur claire et les éléments non pris en charge sont signalés.
- La partition et ses réglages sont sauvegardés automatiquement dans le navigateur et restaurés à la réouverture ; un avertissement s'affiche si la sauvegarde est impossible ou illisible.

<!-- vibe:end:features -->

<!-- vibe:begin:install -->

Prérequis : Node.js 22 ou plus récent.

```sh
npm install
```

<!-- vibe:end:install -->

<!-- vibe:begin:usage -->

```sh
npm run dev      # lance le site en local
npm run build    # produit le site statique dans dist/
npm run preview  # prévisualise le site construit
npm test         # lance les tests
npm run lint     # vérifie et corrige le style
```

<!-- vibe:end:usage -->

<!-- vibe:begin:docs-index -->

Pas de documentation supplémentaire pour l'instant.

<!-- vibe:end:docs-index -->

## Déploiement

Le site est publié sur GitHub Pages à chaque push sur `main`.
