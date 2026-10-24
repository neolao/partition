# Changelog

## [Unreleased]

### Added

- Une portée vide s'affiche à l'ouverture du site et se redessine à la bonne largeur quand la fenêtre est redimensionnée.
- Les utilisateurs peuvent choisir une durée (ronde à double croche), poser des notes et des silences en cliquant sur la portée, déplacer la hauteur d'une note avec les flèches du clavier et supprimer l'élément sélectionné avec Suppr.
- Les utilisateurs peuvent exporter leur partition en fichier MusicXML (notes, silences et durées) depuis le bouton « Exporter MusicXML », y compris pour une partition vide.
- Les utilisateurs peuvent importer un fichier MusicXML depuis le bouton « Importer MusicXML » : la partition s'affiche, un fichier invalide donne une erreur claire et les éléments non pris en charge sont signalés.
- Les utilisateurs peuvent choisir la clé (sol, fa, ut), l'armure et le chiffrage de mesure ; les notes se répartissent en mesures qui respectent le chiffrage, et une mesure trop remplie ou en cours est signalée à l'écran. Ces réglages sont aussi exportés et importés en MusicXML.
- Les utilisateurs peuvent télécharger leur partition en PDF A4 depuis le bouton « Exporter PDF » : les mesures sont réparties en lignes puis en pages sans jamais être coupées, et une partition vide affiche un message clair au lieu d'un PDF vide.
