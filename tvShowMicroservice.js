const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');

// Kafka configuration with retry options
const kafka = new Kafka({
  clientId: 'tvshow-service',
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
const consumer = kafka.consumer({ groupId: 'tvshow-service-group' });

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
    
    await consumer.subscribe({ topic: 'tvshows_topic', fromBeginning: true });
    console.log('Subscribed to tvshows_topic');
    
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

// Charger le fichier tvShow.proto
const tvShowProtoPath = 'tvShow.proto';
const tvShowProtoDefinition = protoLoader.loadSync(tvShowProtoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const tvShowProto = grpc.loadPackageDefinition(tvShowProtoDefinition).tvShow;

// Sample TV show data (in a real system, this would be stored in a database)
const tvShows = [
  {
    id: '1',
    title: 'Exemple de série TV 1',
    description: 'Ceci est le premier exemple de série TV.',
  },
  {
    id: '2',
    title: 'Exemple de série TV 2',
    description: 'Ceci est le deuxième exemple de série TV.',
  },
];

// Implémenter le service de séries TV
const tvShowService = {
  getTvshow: (call, callback) => {
    // Récupérer les détails de la série TV à partir de la base de données
    const tvShowId = call.request.tv_show_id;
    const tv_show = tvShows.find(show => show.id === tvShowId) || {
      id: tvShowId,
      title: 'Exemple de série TV',
      description: 'Ceci est un exemple de série TV.',
    };
    
    callback(null, { tv_show });
  },
  
  searchTvshows: (call, callback) => {
    const { query } = call.request;
    // Effectuer une recherche de séries TV en fonction de la requête
    // In a real implementation, we would filter based on the query
    callback(null, { tv_shows: tvShows });
  },
  
  createTvshow: async (call, callback) => {
    const { tv_show } = call.request;
    
    // Generate ID if not provided
    if (!tv_show.id) {
      tv_show.id = (tvShows.length + 1).toString();
    }
    
    // Add TV show to collection
    tvShows.push(tv_show);
    
    // Send event to Kafka
    await sendMessage('tvshows_topic', {
      event: 'TVSHOW_CREATED',
      data: tv_show
    });
    
    callback(null, { tv_show, success: true });
  }
};

// Créer et démarrer le serveur gRPC
const server = new grpc.Server();
server.addService(tvShowProto.TVShowService.service, tvShowService);
const port = 50052;
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

console.log(`Microservice de séries TV en cours d'exécution sur le port ${port}`); 