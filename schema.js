const typeDefs = `#graphql
  type Movie {
    id: String!
    title: String!
    description: String!
  }

  type TVShow {
    id: String!
    title: String!
    description: String!
  }

  input MovieInput {
    title: String!
    description: String!
    id: String
  }

  input TVShowInput {
    title: String!
    description: String!
    id: String
  }

  type MovieResponse {
    movie: Movie
    success: Boolean
  }

  type TVShowResponse {
    tvShow: TVShow
    success: Boolean
  }

  type Query {
    movie(id: String!): Movie
    movies: [Movie]
    tvShow(id: String!): TVShow
    tvShows: [TVShow]
  }

  type Mutation {
    createMovie(input: MovieInput!): MovieResponse
    createTVShow(input: TVShowInput!): TVShowResponse
  }
`;

module.exports = typeDefs; 