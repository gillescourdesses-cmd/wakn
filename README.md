# Wakn × Aéronautique — Landing 3D « Vol »

Page d'atterrissage immersive en **scroll-telling 3D** pour Wakn (ESN experte en
aéronautique). Au défilement, la caméra parcourt un A320 — du hangar à la cabine
puis au cockpit — pour présenter les 4 offres de services, et se termine par un
plan « en vol ».

## Stack

Site **statique** — aucun build requis. Conçu pour être servi à l'URL
**`wakn.fr/aeronautique`** : tout le site vit dans le dossier `aeronautique/`,
avec des chemins **relatifs** (fonctionne quel que soit le préfixe d'URL).

| Fichier | Rôle |
|---|---|
| `aeronautique/index.html` | Markup + styles inline + chargement des dépendances |
| `aeronautique/main.js` | Logique Three.js : scène, caméra (keyframes), bascule des modèles, moteur de scroll « snap » |
| `aeronautique/assets/` | Modèles 3D, textures et logo |

### Déploiement FTP

Déposez le dossier `aeronautique/` à la racine web du serveur (`www/`,
`public_html/` ou `htdocs/`) → la page est servie à `wakn.fr/aeronautique`.

Rendu 3D : **Three.js r128** (chargé via CDN, avec `GLTFLoader`, `ColladaLoader`,
`BufferGeometryUtils`, `RoomEnvironment`). Police **Poppins** (Google Fonts).

> Portage depuis la référence de design `Wakn Aéronautique - Vol.dc.html`.
> Le wrapper propriétaire `.dc.html` / `support.js` a été écarté : le markup est
> en HTML, la classe `Component` réimplémentée en module vanilla (`main.js`), les
> styles repris tels quels.

## Lancer en local

Un simple serveur statique suffit (le chargement des modèles via `fetch`
nécessite HTTP, pas `file://`) :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Scène 3D

- **Deux modèles d'avion** basculés par visibilité selon la progression `p` :
  - `assets/cockpit/scene-compressed.glb` — A320 extérieur + cockpit (GLB PBR).
  - `assets/a320-interior/model.dae` — cabine intérieure (Collada), uniquement
    pour le chapitre cabine.
- **Hangar** : `assets/hangar/hangar.glb`, recoloré au runtime (parois claires,
  structure sombre, accents teal).
- **Dé-branding livrée** : la texture du fuselage est remplacée au runtime par
  `assets/cockpit/fuselage-clean.png` (dérive repeinte en teal Wakn).
- **Anti-flash** : le loader reste affiché tant que les deux modèles ne sont pas
  prêts, pour ne jamais montrer la livrée brute.

## Tokens de design

- Teal principal `#1f9d86` · accents `#43B59A` / `#5EBCA5`
- Texte vert profond `#06343b` / `#0c463f` · secondaire `#3f5e59`
- Fonds clairs (mint) `#cde7de → #8fc4b6` · section sombre `#053B44 → #012226`
- Police Poppins (300–700) · rayons 100px (pills) / 18px (cartes)

## ⚠️ Licences

Les modèles 3D portent leur propre licence (voir la source d'origine du modèle
cockpit). **Vérifier les droits d'usage avant mise en production.**
