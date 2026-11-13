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
`app.config.js` reprend `app.json` et n'y ajoute que `google-services.json`,
quand ce fichier est présent.

## Notifications push

`expo-notifications` reçoit les messages envoyés par le backend via Firebase
Cloud Messaging, sans passer par les services d'Expo.

- Une fois le couple formé (mode réel uniquement), `src/state/push.tsx` crée
  le canal Android `messages`, demande l'autorisation (Android 13+) et envoie
  le jeton FCM du téléphone à `POST /devices`, puis à nouveau s'il change. La
  déconnexion le retire (`DELETE /devices`).
- Une notification de message ne s'affiche pas quand la Bulle est à l'écran ;
  la toucher ouvre la Bulle, y compris quand elle lance l'app.
- Il faut `mobile/google-services.json` (jamais commité, ignoré par git) :
  sans lui l'app compile et fonctionne, sans notifications. La CI le recrée
  depuis le secret `GOOGLE_SERVICES_JSON`.

Mise en place de Firebase : [docs/push-notifications.md](../docs/push-notifications.md).
