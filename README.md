# Documentation de l'Application

## Introduction

Cette application est une plateforme de partage de position en temps réel et de visioconférence utilisant WebRTC et l'accéléromètre. Elle permet aux utilisateurs de partager leur position actuelle sur une carte interactive, de voir la position des autres utilisateurs, et d'initier des appels vidéo.

## Doc

https://gwilymm.github.io/mds-api-class/

## Fonctionnalités

- **Partage de position en temps réel**: Suivi en temps réel de la position des utilisateurs sur une carte interactive.
- **Visioconférence avec WebRTC**: Appels vidéo entre utilisateurs.
- **Utilisation de l'accéléromètre**: (à implémenter) Utilisation des données de l'accéléromètre pour diverses fonctionnalités.


La visio conférence est presque fonctionnelle, impossible d'afficher le stream distant.
Pas eu le temps de mettre l'acéléromètre en place.

## Structure du Projet

- `index.html`: Fichier HTML principal de l'application.
- `server.js`: Fichier de serveur Node.js pour gérer les connexions WebSocket et les API RESTful.
- `public/`: Dossier contenant les fichiers statiques (CSS, JavaScript, etc.).
- `views/`: Dossier contenant les vues HTML.
- `controllers/`: Dossier contenant les endpoints API RESTful.

## Prérequis

- Node.js et npm installés sur votre machine.
- Connexion internet pour charger les bibliothèques externes (Leaflet, TailwindCSS, etc.).

## Installation

1. Clonez le dépôt de l'application:

   ```bash
   git clone https://github.com/Gwilymm/mds-api-class.git
   cd mds-api-class

2. Installez les dépendances:

   ```bash
   npm install
   ```

3. Lancez le serveur:

   ```bash
   node app.js
   ```

4. Ouvrez votre navigateur et accédez à `http://localhost:3000`.

## Utilisation

### Interface Utilisateur

- **Accueil**: Présente les fonctionnalités de l'application.
- **Formulaire**: Entrez votre nom pour commencer.
- **Carte des Utilisateurs**: Affiche la position des utilisateurs en temps réel sur une carte.
- **Liste des Utilisateurs**: Affiche la liste des utilisateurs avec une option pour initier un appel vidéo.

### Fonctionnalités Clés

1. **Géolocalisation**:
   - L'utilisateur doit autoriser la géolocalisation pour partager sa position.
   - La position est mise à jour toutes les 10 secondes.

2. **Visioconférence**:
   - L'utilisateur peut inviter un autre utilisateur à un appel vidéo.
   - Utilise WebRTC pour établir la connexion vidéo et audio.

### Code Explication

#### HTML (index.html)

- Contient la structure de base de l'application.
- Utilise TailwindCSS pour le style.
- Utilise Leaflet pour la carte interactive.

#### JavaScript (intégré dans index.html)

- **WebSocket**: Gère les connexions en temps réel et l'échange de messages.
- **Géolocalisation**: Récupère et met à jour la position de l'utilisateur.
- **WebRTC**: Gère les appels vidéo.

#### Serveur (server.js)

- Utilise `express` pour le serveur HTTP.
- Utilise `ws` pour les WebSockets.
- API RESTful pour récupérer la liste des utilisateurs.
- Diffuse les mises à jour de position à tous les clients connectés.

## API Endpoints

### GET `/api/users`

- **Description**: Récupère la liste des utilisateurs et leurs positions.
- **Réponse**:
  ```json
  [
    {
      "id": "user-123456789",
      "name": "Nom de l'utilisateur",
      "position": {
        "lat": 48.8566,
        "lng": 2.3522
      }
    },
    ...
  ]
  ```

## Déploiement

Pour déployer l'application sur un serveur de production, assurez-vous d'utiliser un serveur sécurisé (HTTPS) pour les WebSockets et les connexions WebRTC. Vous pouvez utiliser des services de déploiement comme Heroku, AWS, ou DigitalOcean.

## Contribuer

Les contributions sont les bienvenues! Veuillez soumettre des issues et des pull requests pour améliorer l'application.

## Licence

Cette application est sous licence MIT. Veuillez consulter le fichier LICENSE pour plus de détails.

---

## Contact

Pour toute question ou assistance, veuillez contacter l'équipe de développement à quelqu'un

---

Ce README fournit une documentation complète pour installer, utiliser et contribuer à l'application. N'hésitez pas à l'adapter selon vos besoins spécifiques et à ajouter toute information supplémentaire nécessaire.