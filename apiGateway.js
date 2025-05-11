// apiGateway.js
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const cors = require('cors');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');

// Import GraphQL schema and resolvers
const resolvers = require('./resolvers');
const typeDefs = require('./schema');

// Kafka configuration with retry options
const kafka = new Kafka({
  clientId: 'api-gateway',
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

// Function to send message to Kafka
const sendMessage = async (topic, message) => {
  try {
    if (!producer.isConnected) {
      await producer.connect();
      console.log('Kafka producer connected successfully');
    }
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  } catch (error) {
    console.error('Error sending message to Kafka:', error);
    throw error; // Re-throw to handle in the calling function
  }
};

// Initialize Kafka producer
const initKafka = async () => {
  try {
    // Check if Kafka broker is available
    const isKafkaAvailable = await checkKafkaBroker();
    if (!isKafkaAvailable) {
      console.log('Retrying Kafka connection in 5 seconds...');
      setTimeout(initKafka, 5000);
      return;
    }
    
    await producer.connect();
    console.log('Kafka producer connected successfully');
  } catch (error) {
    console.error('Failed to connect to Kafka:', error);
    // Retry after 5 seconds
    setTimeout(initKafka, 5000);
  }
};

// Start Kafka producer
initKafka().catch(error => {
  console.error('Error initializing Kafka:', error);
});

// Charger les fichiers proto pour les films et les séries TV
const movieProtoPath = 'movie.proto';
const tvShowProtoPath = 'tvShow.proto';

const movieProtoDefinition = protoLoader.loadSync(movieProtoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const tvShowProtoDefinition = protoLoader.loadSync(tvShowProtoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const movieProto = grpc.loadPackageDefinition(movieProtoDefinition).movie;
const tvShowProto = grpc.loadPackageDefinition(tvShowProtoDefinition).tvShow;

// Create gRPC clients
const movieClient = new movieProto.MovieService('localhost:50051', grpc.credentials.createInsecure());
const tvShowClient = new tvShowProto.TVShowService('localhost:50052', grpc.credentials.createInsecure());

// Create Express app
const app = express();

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Start the Apollo server
async function startServer() {
  await server.start();
  
  // Apply middleware
  app.use(
    '/graphql',
    cors(),
    bodyParser.json(),
    expressMiddleware(server),
  );

  // REST endpoints for movies
  app.get('/movies', (req, res) => {
    movieClient.searchMovies({}, (err, response) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.json(response.movies);
      }
    });
  });

  app.get('/movies/:id', (req, res) => {
    const id = req.params.id;
    movieClient.getMovie({ movie_id: id }, (err, response) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.json(response.movie);
      }
    });
  });

  app.post('/movies', async (req, res) => {
    const movieData = req.body;
    
    try {
      // Send to Kafka
      await sendMessage('movies_topic', {
        event: 'MOVIE_CREATED',
        data: movieData
      });
      
      // Call the gRPC service
      movieClient.createMovie({ movie: movieData }, (err, response) => {
        if (err) {
          console.error('Error calling movie service:', err);
          res.status(500).send({ error: 'Failed to create movie', details: err.message });
        } else {
          res.json(response);
        }
      });
    } catch (error) {
      console.error('Error in /movies POST endpoint:', error);
      res.status(500).send({ error: 'Failed to process request', details: error.message });
    }
  });

  // REST endpoints for TV Shows
  app.get('/tvshows', (req, res) => {
    tvShowClient.searchTvshows({}, (err, response) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.json(response.tv_shows);
      }
    });
  });

  app.get('/tvshows/:id', (req, res) => {
    const id = req.params.id;
    tvShowClient.getTvshow({ tv_show_id: id }, (err, response) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.json(response.tv_show);
      }
    });
  });

  app.post('/tvshows', async (req, res) => {
    const tvShowData = req.body;
    
    try {
      // Send to Kafka
      await sendMessage('tvshows_topic', {
        event: 'TVSHOW_CREATED',
        data: tvShowData
      });
      
      // Call the gRPC service
      tvShowClient.createTvshow({ tv_show: tvShowData }, (err, response) => {
        if (err) {
          console.error('Error calling TV show service:', err);
          res.status(500).send({ error: 'Failed to create TV show', details: err.message });
        } else {
          res.json(response);
        }
      });
    } catch (error) {
      console.error('Error in /tvshows POST endpoint:', error);
      res.status(500).send({ error: 'Failed to process request', details: error.message });
    }
  });

  // Start the Express server
  const port = 3000;
  app.listen(port, () => {
    console.log(`API Gateway en cours d'exécution sur le port ${port}`);
    console.log(`GraphQL endpoint: http://localhost:${port}/graphql`);
  });
}

// Enable CORS and JSON parsing
app.use(cors());
app.use(bodyParser.json());

// Start the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
}); 