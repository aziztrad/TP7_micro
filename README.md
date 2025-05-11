# Architecture Microservices avec gRPC, Kafka, REST et GraphQL

Ce projet démontre une architecture microservices construite avec Node.js, mettant en œuvre la communication via gRPC, Kafka, et une passerelle API fournissant des points d'accès REST et GraphQL.

## Vue d'ensemble de l'Architecture

Le système se compose de :

- **Microservice Films** : Gère les données des films, communique via gRPC
- **Microservice Séries TV** : Gère les données des séries TV, communique via gRPC
- **Passerelle API** : Point d'entrée pour les clients, fournit des points d'accès REST et GraphQL
- **Kafka** : Utilisé pour la communication asynchrone entre les services

## Prérequis

- Node.js (v14+)
- Apache Kafka et Zookeeper en exécution locale
- npm

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Démarrer Zookeeper et Kafka :
```bash
# Démarrer Zookeeper
bin\windows\zookeeper-server-start.sh config/zookeeper.properties

# Démarrer Kafka
bin\windows\kafka-server-start.sh config/server.properties
```

3. Créer les topics Kafka :
```bash
bin\windows\kafka-topics.bat --create --partitions 1 --replication-factor 1 --topic movies_topic --bootstrap-server localhost:9092
bin\windows\kafka-topics.bat --create --partitions 1 --replication-factor 1 --topic tvshows_topic --bootstrap-server localhost:9092
```

## Lancement des Microservices

Démarrer chaque composant dans un terminal séparé :

1. Démarrer le Microservice Films :
```bash
node movieMicroservice.js
```

2. Démarrer le Microservice Séries TV :
```bash
node tvShowMicroservice.js
```

3. Démarrer la Passerelle API :
```bash
node apiGateway.js
```

## Utilisation de l'API

### Points d'accès REST

- **GET /movies** - Obtenir tous les films
- **GET /movies/:id** - Obtenir un film spécifique
- **POST /movies** - Créer un nouveau film
- **GET /tvshows** - Obtenir toutes les séries TV
- **GET /tvshows/:id** - Obtenir une série TV spécifique
- **POST /tvshows** - Créer une nouvelle série TV

### GraphQL

Point d'accès GraphQL : http://localhost:3000/graphql

Exemples de requêtes :

```graphql
# Obtenir tous les films
query {
  movies {
    id
    title
    description
  }
}

# Obtenir un film spécifique
query {
  movie(id: "1") {
    id
    title
    description
  }
}

# Créer un film
mutation {
  createMovie(input: {
    title: "Nouveau Film"
    description: "Description du nouveau film"
  }) {
    movie {
      id
      title
      description
    }
    success
  }
}
```

## Dépannage

### Problèmes de Connexion Kafka

Si vous rencontrez des erreurs de connexion Kafka comme `getaddrinfo EAI_AGAIN kafka` ou `Connection error: getaddrinfo EAI_AGAIN kafka`, cela signifie que l'application essaie de se connecter à un broker Kafka avec le nom d'hôte "kafka" qui n'existe pas.

Ce projet inclut maintenant une fonction de résolution de nom d'hôte personnalisée qui mappe automatiquement `kafka` vers `localhost`. Si vous voyez toujours cette erreur, essayez ces solutions :

1. Exécutez d'abord l'utilitaire de vérification Kafka pour vérifier la connectivité :
```bash
npm run kafka-check
```

Cet utilitaire va :
- Vérifier si Kafka est disponible sur localhost:9092
- Vérifier si les topics requis existent et les créer si nécessaire
- Fournir des informations détaillées sur les erreurs si Kafka n'est pas disponible

2. Si vous avez toujours des problèmes, assurez-vous qu'aucune variable d'environnement comme `KAFKA_BOOTSTRAP_SERVER` n'est définie qui pourrait remplacer votre configuration :
```bash
unset KAFKA_BOOTSTRAP_SERVER
```

3. Si vous utilisez Docker ou un environnement différent où le broker Kafka n'est pas sur localhost :
   - Mettez à jour l'adresse du broker dans tous les fichiers pour correspondre à votre environnement
   - Ajustez la fonction de résolution de nom d'hôte personnalisée dans chaque fichier pour mapper correctement

### Résolution Manuelle du Nom d'Hôte

Si la résolution automatique du nom d'hôte ne fonctionne pas, vous pouvez ajouter une entrée manuelle dans votre fichier hosts :

```bash
# Sur Windows, éditer C:\Windows\System32\drivers\etc\hosts
echo "127.0.0.1 kafka" >> C:\Windows\System32\drivers\etc\hosts
```


## Détails de l'Architecture

- **Communication gRPC** : Utilisée pour la communication entre services
- **Intégration Kafka** : Permet la communication asynchrone entre les services
- **Passerelle API** : Expose des API REST et GraphQL unifiées aux clients
- **Stockage en Mémoire** : À des fins de démonstration (peut être remplacé par une base de données) 
