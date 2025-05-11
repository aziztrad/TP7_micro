# Plateforme de Microservices Multi-Protocoles

Ce projet implémente une architecture moderne de microservices utilisant Node.js avec plusieurs protocoles de communication : gRPC pour les appels inter-services, Apache Kafka pour la messagerie événementielle, et une API Gateway exposant des interfaces REST et GraphQL.

## Architecture du Système

L'architecture se compose de :

- **Service Contenu Cinématographique** : Gestion des données relatives aux films
- **Service Contenu Télévisuel** : Gestion des données relatives aux séries
- **Passerelle d'Agrégation** : Interface unifiant les services backend pour les clients
- **Bus d'Événements** : Système de messagerie asynchrone basé sur Kafka

## Technologies Utilisées

- **Backend** : Node.js
- **Communication Synchrone** : gRPC (Google Remote Procedure Call)
- **Communication Asynchrone** : Apache Kafka
- **API** : REST et GraphQL
- **Stockage** : Mémoire interne (remplaçable par une DB)

## Démarrage Rapide

### Environnement Requis

- Node.js version 14 ou supérieure
- Apache Kafka 3.x
- Apache Zookeeper

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/votre-username/microservices-platform.git
cd microservices-platform

# Installer les dépendances des trois services
npm install
```

### Configuration de Kafka

1. Démarrer l'écosystème Kafka :

```bash
# Démarrer Zookeeper (premier terminal)
cd [dossier-kafka]
bin\windows\zookeeper-server-start.bat config\zookeeper.properties

# Démarrer le broker Kafka (second terminal)
cd [dossier-kafka]
bin\windows\kafka-server-start.bat config\server.properties
```

2. Créer les canaux de communication :

```bash
# Créer le topic pour les événements liés aux films
bin\windows\kafka-topics.bat --create --topic cinema-events --partitions 1 --replication-factor 1 --bootstrap-server localhost:9092

# Créer le topic pour les événements liés aux séries
bin\windows\kafka-topics.bat --create --topic television-events --partitions 1 --replication-factor 1 --bootstrap-server localhost:9092
```

### Démarrage des Services

Lancer chaque service dans un terminal séparé :

```bash
# Service Cinématographique
node cinema-service.js

# Service Télévisuel
node television-service.js

# Passerelle d'API
node api-gateway.js
```

## Utilisation des API

### Interface REST

La passerelle expose les endpoints REST suivants sur `http://localhost:3000` :

#### Endpoints Films

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/cinema | Récupérer tous les films |
| GET | /api/cinema/:id | Récupérer un film spécifique |
| POST | /api/cinema | Créer un nouveau film |
| PUT | /api/cinema/:id | Mettre à jour un film |
| DELETE | /api/cinema/:id | Supprimer un film |

#### Endpoints Séries

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/television | Récupérer toutes les séries |
| GET | /api/television/:id | Récupérer une série spécifique |
| POST | /api/television | Créer une nouvelle série |
| PUT | /api/television/:id | Mettre à jour une série |
| DELETE | /api/television/:id | Supprimer une série |

### Interface GraphQL

Le point d'entrée GraphQL est disponible à `http://localhost:3000/graphql`

#### Exemples de Requêtes

```graphql
# Récupérer la liste des films
query {
  getAllCinema {
    id
    title
    director
    releaseYear
    genre
  }
}

# Récupérer un film par ID
query {
  getCinemaById(id: "1") {
    title
    synopsis
    rating
  }
}

# Créer un nouveau film
mutation {
  addCinema(
    input: {
      title: "Le Nouveau Chef-d'œuvre"
      director: "Réalisateur Connu"
      releaseYear: 2023
      genre: "Science-Fiction"
      synopsis: "Un film révolutionnaire"
    }
  ) {
    id
    title
    success
  }
}

# Récupérer la liste des séries
query {
  getAllTelevision {
    id
    title
    seasons
    creator
  }
}
```

## Structure des Données

### Modèle Film

```javascript
{
  id: String,
  title: String,
  director: String,
  releaseYear: Number,
  genre: String,
  synopsis: String,
  rating: Number
}
```

### Modèle Série

```javascript
{
  id: String,
  title: String,
  seasons: Number,
  episodes: Number,
  creator: String,
  startYear: Number,
  endYear: Number,
  status: String,
  synopsis: String
}
```

## Détails d'Implémentation

### Communication gRPC

Les services backend utilisent gRPC pour une communication efficace et typée :

```proto
// Exemple simplifié du fichier .proto pour le service cinématographique
service CinemaService {
  rpc GetAllCinema (Empty) returns (CinemaList);
  rpc GetCinemaById (CinemaId) returns (Cinema);
  rpc CreateCinema (Cinema) returns (CinemaResponse);
}

message Cinema {
  string id = 1;
  string title = 2;
  string director = 3;
  int32 releaseYear = 4;
  string genre = 5;
  string synopsis = 6;
  float rating = 7;
}
```

### Communication par Événements

Les services publient des événements sur les canaux Kafka pour informer les autres services des changements importants :

```javascript
// Exemple de production d'événements
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'cinema-service',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

async function publishEvent(event) {
  await producer.connect();
  await producer.send({
    topic: 'cinema-events',
    messages: [
      { value: JSON.stringify(event) }
    ],
  });
}
```

## Résolution des Problèmes Courants

### Problèmes de Connexion à Kafka

Si vous rencontrez des erreurs de connexion comme `ECONNREFUSED`:

1. **Vérifier que Kafka est bien démarré**:
   ```bash
   # Lister les topics pour vérifier que Kafka répond
   bin\windows\kafka-topics.bat --list --bootstrap-server localhost:9092
   ```

2. **Problèmes avec les noms d'hôtes**:
   - Essayez de changer les brokers à `127.0.0.1` au lieu de `localhost` dans le code
   - Ajoutez une entrée dans votre fichier hosts local si nécessaire

3. **Vérifier les ports**:
   - Assurez-vous que le port 9092 est disponible et non bloqué par un pare-feu

### Échecs de Connexion gRPC

Si les services ne peuvent pas communiquer via gRPC:

1. **Vérifier que les services sont démarrés** dans le bon ordre
2. **Déboguer avec les options de traçage gRPC**:
   ```javascript
   const grpc = require('@grpc/grpc-js');
   grpc.setLogVerbosity(grpc.logVerbosity.DEBUG);
   ```

## Modèles de Conception Utilisés

- **API Gateway** : Point d'entrée unique pour les clients, simplifiant l'accès aux microservices
- **Event-Driven Architecture** : Communication asynchrone via Kafka pour le découplage
- **Backend for Frontend (BFF)** : La Gateway adapte les réponses selon les besoins des clients
- **Circuit Breaker** : Protection contre les défaillances en cascade
