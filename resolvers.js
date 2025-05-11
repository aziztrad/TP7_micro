const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

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

// Helper function to create gRPC clients
const getMovieClient = () => {
  return new movieProto.MovieService('localhost:50051', grpc.credentials.createInsecure());
};

const getTVShowClient = () => {
  return new tvShowProto.TVShowService('localhost:50052', grpc.credentials.createInsecure());
};

// Définir les résolveurs pour les requêtes GraphQL
const resolvers = {
  Query: {
    movie: (_, { id }) => {
      // Effectuer un appel gRPC au microservice de films
      const client = getMovieClient();
      return new Promise((resolve, reject) => {
        client.getMovie({ movie_id: id }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response.movie);
          }
        });
      });
    },
    movies: () => {
      // Effectuer un appel gRPC au microservice de films
      const client = getMovieClient();
      return new Promise((resolve, reject) => {
        client.searchMovies({ query: '' }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response.movies);
          }
        });
      });
    },
    tvShow: (_, { id }) => {
      // Effectuer un appel gRPC au microservice de séries TV
      const client = getTVShowClient();
      return new Promise((resolve, reject) => {
        client.getTvshow({ tv_show_id: id }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response.tv_show);
          }
        });
      });
    },
    tvShows: () => {
      // Effectuer un appel gRPC au microservice de séries TV
      const client = getTVShowClient();
      return new Promise((resolve, reject) => {
        client.searchTvshows({ query: '' }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response.tv_shows);
          }
        });
      });
    },
  },
  Mutation: {
    createMovie: (_, { input }) => {
      const client = getMovieClient();
      return new Promise((resolve, reject) => {
        client.createMovie({ movie: input }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve({ movie: response.movie, success: response.success });
          }
        });
      });
    },
    createTVShow: (_, { input }) => {
      const client = getTVShowClient();
      return new Promise((resolve, reject) => {
        client.createTvshow({ tv_show: input }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve({ tvShow: response.tv_show, success: response.success });
          }
        });
      });
    }
  }
};

module.exports = resolvers; 