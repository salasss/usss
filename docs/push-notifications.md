# Notifications push

Quand l'un de vous écrit dans la Bulle et que l'autre n'a pas l'app ouverte
(fermée ou en arrière-plan), son téléphone affiche une notification : le
prénom de l'expéditeur, puis le texte (raccourci à 120 caractères),
« 📷 Photo » ou « 🎤 Message vocal ». Toucher la notification ouvre la Bulle.

```
téléphone A ─(WebSocket)─► backend ─► base (message enregistré)
                              │  B n'a aucune connexion ouverte ?
                              ▼
            Firebase Cloud Messaging (API HTTP v1) ─► téléphone B
```

Le backend parle directement à Firebase Cloud Messaging (FCM) avec un compte
de service : aucun service Expo n'intervient. FCM est gratuit (offre Spark,
sans carte bancaire).

| Élément                   | Où                                  | Sert à                                  |
| ------------------------- | ----------------------------------- | --------------------------------------- |
| `google-services.json`    | secret GitHub `GOOGLE_SERVICES_JSON` | l'APK obtient un jeton FCM              |
| Clé du compte de service  | variable `FCM_SERVICE_ACCOUNT` du backend | le backend envoie les notifications |

Les deux sont facultatifs : sans eux, l'app et le backend fonctionnent comme
avant, simplement sans notifications.

## 1. Créer le projet Firebase

1. Ouvrez la [console Firebase](https://console.firebase.google.com) →
   **Créer un projet** (par exemple `usss`). Google Analytics n'est pas
   nécessaire. Vous pouvez aussi ajouter Firebase au projet Google Cloud déjà
   utilisé pour la connexion Google.
2. Dans le projet : **Ajouter une application → Android**.
   - Nom du package Android : `com.salasss.usss`
   - Surnom : `usss` ; l'empreinte SHA-1 n'est pas nécessaire pour FCM.
3. Téléchargez **`google-services.json`**. Ignorez les étapes « Ajouter le
   SDK Firebase » : Expo s'en charge au moment du build.
4. Vérifiez **Paramètres du projet → Cloud Messaging** : *API Firebase Cloud
   Messaging (V1)* doit être **activée** (c'est le cas par défaut pour un
   nouveau projet).

## 2. L'APK : secret `GOOGLE_SERVICES_JSON`

Le fichier contient une clé d'API restreinte à l'app : elle finit dans l'APK
(comme la clé *anon* de Supabase), mais elle ne doit pas être versionnée.
`google-services.json` est ignoré par git.

Encodez-le en base64 sur une seule ligne :

```bash
base64 -w0 google-services.json            # Linux, Git Bash
base64 -i google-services.json             # macOS
```

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json"))
```

Puis GitHub → **Settings → Secrets and variables → Actions → New repository
secret** : nom `GOOGLE_SERVICES_JSON`, valeur = la ligne base64.

Au prochain build, la CI recrée `mobile/google-services.json` avant
`expo prebuild` et le supprime en fin de job ; le résumé du run indique
« with push notifications ». Pour un build local, copiez simplement le fichier
dans `mobile/google-services.json` : [`mobile/app.config.js`](../mobile/app.config.js)
ne l'ajoute à la configuration Android que s'il existe.

## 3. Le backend : variable `FCM_SERVICE_ACCOUNT`

1. Console Firebase → **Paramètres du projet → Comptes de service** →
   **Générer une nouvelle clé privée**. Un fichier JSON est téléchargé.
2. Cette clé permet d'envoyer des notifications en votre nom : traitez-la
   comme un mot de passe et ne la commitez jamais.
3. Chez l'hébergeur du backend, créez la variable d'environnement
   `FCM_SERVICE_ACCOUNT` avec, au choix :
   - le base64 du fichier (`base64 -w0 usss-firebase-adminsdk.json`), le plus
     simple, aussi dans `backend/.env` ;
   - le JSON brut, si l'hébergeur accepte les valeurs multilignes.
4. Redémarrez le backend. Le journal de démarrage indique
   `push notifications enabled (Firebase Cloud Messaging)` et l'identifiant du
   projet. Sans la variable : `push notifications are disabled`. Une clé
   invalide empêche le démarrage avec un message explicite (la clé n'est
   jamais affichée).
5. Supprimez le fichier téléchargé une fois la variable enregistrée (gardez-en
   une copie dans un gestionnaire de mots de passe si besoin).

## 4. Tester

1. Installez le nouvel APK sur les deux téléphones et connectez-vous. En
   arrivant dans votre espace, l'app demande l'autorisation d'envoyer des
   notifications (Android 13 et plus) : **Autoriser**.
2. Dans Supabase → **SQL Editor** :
   `select user_id, platform, updated_at from public.push_tokens;`
   doit montrer une ligne par téléphone.
3. Sur le téléphone B, revenez à l'écran d'accueil ou fermez l'app. Depuis
   le téléphone A, envoyez un message : B reçoit la notification. Touchez-la :
   la Bulle s'ouvre.
4. App ouverte sur B : pas de notification, le message arrive directement
   (et le badge de l'onglet Bulle s'allume si B est sur un autre onglet).

| Situation du destinataire                         | Résultat                         |
| ------------------------------------------------- | -------------------------------- |
| App ouverte, quel que soit l'écran                | message en direct, pas de notification |
| App en arrière-plan, écran verrouillé, app fermée | notification                     |
| Connexion coupée sans fermer l'app (tunnel…)      | le serveur s'en aperçoit en 70 s au plus ; pas de notification d'ici là |

## Fonctionnement

- L'app enregistre le jeton FCM du téléphone avec `POST /devices` une fois le
  couple formé, et à nouveau si FCM le renouvelle. La déconnexion le retire
  (`DELETE /devices`). Si quelqu'un d'autre se connecte sur le même téléphone,
  le jeton lui est transféré.
- Les jetons vivent dans la table `public.push_tokens`, que seul le backend
  lit et écrit (RLS active, aucun droit pour l'API Supabase).
- À chaque nouveau message, si le ou la partenaire n'a aucune connexion
  temps réel ouverte, le backend notifie chacun de ses téléphones, dans une
  tâche séparée qui ne ralentit jamais la conversation. Un message renvoyé
  après une reconnexion ne notifie pas deux fois.
- Le backend signe un JWT (RS256) avec la clé du compte de service, l'échange
  contre un jeton d'accès OAuth2 (mis en cache environ une heure) et appelle
  `https://fcm.googleapis.com/v1/projects/<projet>/messages:send`, sur le
  canal Android `messages` en priorité haute.
- Un jeton refusé par FCM (app désinstallée, `UNREGISTERED`, jeton d'un autre
  projet) est supprimé. Dix téléphones au plus sont gardés par personne.

## Dépannage

| Symptôme                                     | Piste                                         |
| -------------------------------------------- | --------------------------------------------- |
| Aucune ligne dans `push_tokens`              | APK construit sans `GOOGLE_SERVICES_JSON` (voir le résumé du run), notifications refusées, ou backend injoignable |
| Plus de demande d'autorisation               | Paramètres Android → Applications → usss → Notifications |
| Ligne présente mais rien n'arrive            | Journal du backend : `no access token` (clé ou horloge du serveur), `FCM rejected the message: 403` (API FCM désactivée, droits du compte de service) |
| Les lignes disparaissent à chaque message    | Journal `forgot a push token` : `google-services.json` et la clé du compte de service viennent de deux projets Firebase différents |
| Notifications en retard                      | Optimisation de batterie de certains fabricants : retirez usss des apps optimisées |

Les tests du backend (`cargo test`) simulent Firebase : un faux serveur
OAuth et FCM vérifie le contenu exact des notifications et la suppression
des jetons `UNREGISTERED`.
