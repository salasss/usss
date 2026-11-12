# usss · mobile

Application Android de usss : React Native + Expo (SDK 58, TypeScript, Expo Router).

## Prérequis

- Node.js **22.13+** (24 LTS recommandé)
- JDK 17 et le SDK Android pour compiler en local (sinon : la CI GitHub génère l'APK)

## Commandes

```bash
npm install
npm run android      # build + installation sur un téléphone/émulateur (dev client)
npm start            # serveur Metro pour le dev client déjà installé
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run prebuild     # génère le projet natif android/ (non versionné)
```

## Structure

```
src/
  app/            routes Expo Router (fichiers = écrans)
    (tabs)/       Notre espace · Bulle · Souvenirs
  components/     composants réutilisables (ui/, brand/, navigation/)
  theme/          couleurs, typographies, rayons, espacements
assets/images/    icône, icône adaptative Android, splash
```

Le dossier `android/` est généré par `expo prebuild` (Continuous Native
Generation) : toute la configuration native passe par `app.json` et les plugins.
