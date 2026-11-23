# Alamb'hic — appli Android

Enveloppe **Capacitor 8** autour de l'appli en ligne (`https://alambhic.onrender.com/?app=native`), sur le modèle d'Airmony.

- `capacitor.config.json` : identifiant `app.alambhic`, ouverture de l'appli en ligne, couleurs bleu nuit, domaines autorisés (site, connexion Google).
- `www/index.html` : page affichée sans connexion.
- `native/android/patch_android.py` : permissions, icônes (`res/`), écran de démarrage, clé de test fixe, numéro de version.
- `native/android/alambhic-test.jks` : clé de **test** (mot de passe `alambhic-test`), pour que chaque version s'installe par-dessus la précédente. Jamais pour Google Play.

## Fabrication
GitHub Actions « Appli Android » (`.github/workflows/android.yml`) : à chaque modification du dossier `mobile/`, ou à la demande
(onglet Actions → Appli Android → Run workflow). Le fichier `Alambhic-Android-test.apk` est publié dans Releases → « Appli Android (test) ».

## Limites de cette première version
- Les notifications push du navigateur ne fonctionnent pas dans l'enveloppe : il faudra Firebase Cloud Messaging (projet Firebase,
  fichier `google-services.json`, variable `FCM_SERVICE_ACCOUNT` sur Render), comme pour Airmony.
- Le widget « mes potes » viendra avec un module natif.
- Connexion Google : elle s'ouvre dans la vue web ; à vérifier sur téléphone (Google peut refuser les vues web intégrées).
