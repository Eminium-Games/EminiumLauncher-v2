# GitHub Workflows Documentation

## Overview

Ce projet utilise GitHub Actions pour automatiser les builds, les releases et les mises à jour de l'Eminium Games Launcher.

## Workflows disponibles

### 1. Build and Release (`build.yml`)

**Déclencheur** : Push sur la branche `master`

**Fonctionnalités** :
- Build multi-plateformes (Windows, macOS, Linux)
- Génération des fichiers d'installation :
  - Windows : `.exe` (NSIS)
  - macOS : `.dmg` et `.zip` (signé si certificat disponible)
  - Linux : `.AppImage`
- Upload des artifacts pour 30 jours
- Support des signatures macOS avec `CSC_LINK` et `CSC_KEY_PASSWORD`

### 2. Auto Release (`auto-release.yml`)

**Déclencheur** : Push sur la branche `master`

**Fonctionnalités** :
- Création automatique des tags de version
- Génération des releases GitHub
- Publication des fichiers de mise à jour (`latest.yml`, `latest-mac.yml`)
- Notes de release générées automatiquement

### 3. Create Release (`release.yml`)

**Déclencheur** : Push de tags (ex: `v2.2.2`)

**Fonctionnalités** :
- Création manuelle des releases
- Publication des builds et fichiers de mise à jour

### 4. Update Check (`update-check.yml`)

**Déclencheur** : Schedule toutes les 6 heures

**Fonctionnalités** :
- Surveillance des mises à jour (placeholder)

## Configuration requise

### Secrets GitHub

Pour les builds macOS signés, ajoutez ces secrets dans votre repository :

1. `CSC_LINK` : Lien vers le certificat de développeur Apple (base64)
2. `CSC_KEY_PASSWORD` : Mot de passe du certificat

### Fichiers de build

- `build/entitlements.mac.plist` : Entitlements pour macOS
- `build/dmg-background.png` : Image de fond pour le DMG (optionnel)

## Processus de release

### Automatique (recommandé)

1. Mettez à jour la version dans `package.json`
2. Pushez sur la branche `master`
3. Le workflow `auto-release.yml` :
   - Crée le tag `vX.X.X`
   - Lance les builds sur toutes les plateformes
   - Crée la release GitHub
   - Publie les fichiers de mise à jour

### Manuel

1. Créez un tag manuellement :
   ```bash
   git tag v2.2.2
   git push origin v2.2.2
   ```
2. Le workflow `release.yml` se déclenche automatiquement

## Fichiers générés

### Windows
- `EminiumGamesLauncher-setup-2.2.2.exe`
- `latest.yml` (fichier de mise à jour)

### macOS
- `EminiumGamesLauncher-2.2.2.dmg`
- `EminiumGamesLauncher-2.2.2-arm64.dmg`
- `EminiumGamesLauncher-2.2.2.zip`
- `latest-mac.yml` (fichier de mise à jour)

### Linux
- `EminiumGamesLauncher-2.2.2.AppImage`

## Mises à jour automatiques

Le launcher utilise `electron-updater` pour vérifier automatiquement les mises à jour :

- Les fichiers `latest.yml` et `latest-mac.yml` contiennent les informations de version
- Le launcher vérifie les mises à jour au démarrage
- Les utilisateurs sont notifiés quand une nouvelle version est disponible

## Dépannage

### Build macOS échoue
- Vérifiez que les secrets `CSC_LINK` et `CSC_KEY_PASSWORD` sont configurés
- Assurez-vous que le certificat est valide

### Mises à jour ne fonctionnent pas
- Vérifiez que les fichiers `latest.yml` sont présents dans la release
- Assurez-vous que l'URL de mise à jour dans `dev-app-update.yml` est correcte

### Build lent
- Les builds macOS prennent plus de temps à cause de la signature
- Le workflow attend 5 minutes entre la création du tag et le téléchargement des artifacts
