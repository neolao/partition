# partition

Site statique pour écrire une partition de musique dans le navigateur, générer un PDF à imprimer, et importer ou exporter la partition au format MusicXML.

<!-- vibe:begin:features -->

- Une portée s'affiche à l'ouverture et s'adapte à la largeur de la fenêtre.
- On choisit une durée (ronde à double croche), puis un clic sur la portée pose une note ou un silence.
- Les flèches haut et bas changent la hauteur de la note sélectionnée ; Suppr supprime l'élément sélectionné.

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
