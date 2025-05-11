const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');

// Kafka configuration with retry options
const kafka = new Kafka({
  clientId: 'movie-service',
  brokers: ['localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  },
  connectionTimeout: 3000,
  authenticationTimeout: 1000,
  // Add custom hostname resolution to force kafka hostname to localhost
  socket: {
    timeout: 30000,
    keepAlive: true,
    keepAliveDelay: 1000,
    lookupFunction: (hostname, options, callback) => {
      // Force 'kafka' hostname to resolve to localhost
      if (hostname === 'kafka') {
        return callback(null, ['127.0.0.1'], 4);
      }
      
      // For all other hostnames, use the default DNS lookup
      return require('dns').lookup(hostname, options, callback);
    }
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'movie-service-group' });

// Function to send message to Kafka
const sendMessage = async (topic, message) => {
  try {
    if (!producer.isConnected) {
      await producer.connect();
    }
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  } catch (error) {
    console.error('Error sending message to Kafka:', error);
  }
};

// Function to check if Kafka broker is available
const checkKafkaBroker = async () => {
  const admin = kafka.admin();
  
  try {
    console.log('Checking Kafka broker availability...');
    await admin.connect();
    await admin.listTopics();
    await admin.disconnect();
    console.log('Kafka broker is available!');
    return true;
  } catch (error) {
    console.error('Kafka broker is not available:', error.message);
    console.error('Make sure Kafka is running on localhost:9092');
    return false;
  }
};

// Function to consume messages from Kafka
const consumeMessages = async () => {
  try {
    // Check if Kafka broker is available
    const isKafkaAvailable = await checkKafkaBroker();
    if (!isKafkaAvailable) {
      console.log('Retrying Kafka connection in 5 seconds...');
      setTimeout(consumeMessages, 5000);
      return;
    }
    
    await consumer.connect();
    console.log('Kafka consumer connected successfully');
    
    await consumer.subscribe({ topic: 'movies_topic', fromBeginning: true });
    console.log('Subscribed to movies_topic');
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        console.log(`Received message: ${message.value.toString()}`);
        // Process the message here
      },
    });
  } catch (error) {
    console.error('Error consuming messages from Kafka:', error);
    // Implement a reasonable retry mechanism
    setTimeout(consumeMessages, 5000);
  }
};

// Add error event handlers
consumer.on(consumer.events.CRASH, (event) => {
  console.error('Consumer crashed!', event.payload.error);
  // Implement a reasonable retry mechanism
  setTimeout(consumeMessages, 5000);
});

// Start Kafka consumer
consumeMessages().catch(error => {
  console.error('Failed to start Kafka consumer:', error);
  // Implement a reasonable retry mechanism
  setTimeout(consumeMessages, 5000);
});

// Charger le fichier movie.proto
const movieProtoPath = 'movie.proto';
const movieProtoDefinition = protoLoader.loadSync(movieProtoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const movieProto = grpc.loadPackageDefinition(movieProtoDefinition).movie;

// Sample movie data (in a real system, this would be stored in a database)
const movies = [
  {
    id: '1',
    title: 'Exemple de film 1',
    description: 'Ceci est le premier exemple de film.',
  },
  {
    id: '2',
    title: 'Exemple de film 2',
    description: 'Ceci est le deuxième exemple de film.',
  },
];

// Implémenter le service movie
const movieService = {
  getMovie: (call, callback) => {
    // Récupérer les détails du film à partir de la base de données
    const movieId = call.request.movie_id;
    const movie = movies.find(m => m.id === movieId) || {
      id: movieId,
      title: 'Exemple de film',
      description: 'Ceci est un exemple de film.',
    };
    
    callback(null, { movie });
  },
  
  searchMovies: (call, callback) => {
    const { query } = call.request;
    // Effectuer une recherche de films en fonction de la requête
    // In a real implementation, we would filter based on the query
    callback(null, { movies });
  },
  
  createMovie: async (call, callback) => {
    const { movie } = call.request;
    
    // Generate ID if not provided
    if (!movie.id) {
      movie.id = (movies.length + 1).toString();
    }
    
    // Add movie to collection
    movies.push(movie);
    
    // Send event to Kafka
    await sendMessage('movies_topic', {
      event: 'MOVIE_CREATED',
      data: movie
    });
    
    callback(null, { movie, success: true });
  }
};

// Créer et démarrer le serveur gRPC
const server = new grpc.Server();
server.addService(movieProto.MovieService.service, movieService);
const port = 50051;
server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      console.error('Échec de la liaison du serveur:', err);
      return;
    }
    console.log(`Le serveur s'exécute sur le port ${port}`);
    server.start();
  }
);

console.log(`Microservice de films en cours d'exécution sur le port ${port}`); 