# Ancalagon Companion — Android V0.2

Application Android native légère autour de la fiche mobile existante.

- WebView embarquée : aucun PC/serveur requis à l'exécution.
- Données de personnage : localStorage de la WebView Android.
- Jets de dés : pop-up près du point touché, durée 10 secondes.
- Gemmaline : pont réseau Android limité à HTTPS + gemmaline.com + /sorts/ ou /dons/.
- Les pages Gemmaline sont analysées côté JavaScript ; seuls les éléments explicitement ajoutés sont sauvegardés localement.

## Build
Le workflow `.github/workflows/build-apk.yml` produit `app-debug.apk`, signé automatiquement avec la clé debug Android par l'Android Gradle Plugin.
