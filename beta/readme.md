# Belgique vs France – Scoreboard PWA

## Règles de contribution
- Ne pas ajouter de fichiers binaires (images bitmap exportées, archives, exécutables, etc.). Utiliser uniquement des formats texte ou des ressources vectorielles.

## Passage à une nouvelle version de l'application
1. Mettre à jour la constante `APP_VERSION` dans `app.js` pour refléter le nouveau numéro.
2. Aligner le `<title>` et le badge `.app__version` dans `index.html` sur cette valeur pour que l'interface affiche la bonne révision.
3. Adapter le `manifest.webmanifest` : `name`, `short_name` et `start_url` doivent contenir le numéro de version (le `start_url` utilise un paramètre `?v=` afin de casser le cache navigateur).
4. Incrémenter `CACHE_NAME` dans `sw.js` et remplacer l'entrée correspondante du tableau `ASSETS` par la nouvelle URL versionnée (`./?v=xx`). Cela force le téléchargement des ressources actualisées.
5. Après déploiement, recharger la page : le service worker détectera la nouvelle version et rafraîchira automatiquement l'application.

### Exemple : passer de 0.05 à 0.06
- `app.js` : remplacer `APP_VERSION = '0.05'` par `APP_VERSION = '0.06'`.
- `index.html` : mettre à jour le `<title>` et l'attribut `aria-label` du badge de version pour afficher `0.06`.
- `manifest.webmanifest` : modifier `name`, `short_name` et `start_url` pour qu'ils terminent par `0.06`.
- `sw.js` : incrémenter `CACHE_NAME` (ex. `belgfr-scoreboard-v6`) et ajuster l'entrée `./?v=0.06`.
- `readme.md` : actualiser cet exemple pour conserver une trace de la dernière montée de version.
- Vérifier qu'aucune ressource en cache ne mentionne l'ancienne version avant de redéployer.
