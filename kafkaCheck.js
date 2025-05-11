// kafkaCheck.js
const { Kafka } = require('kafkajs');

// Create a Kafka instance with explicit broker address
const kafka = new Kafka({
  clientId: 'kafka-check',
  brokers: ['localhost:9092'],
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

const admin = kafka.admin();

const checkKafka = async () => {
  try {
    console.log('Checking Kafka broker availability...');
    await admin.connect();
    const topics = await admin.listTopics();
    console.log('Kafka broker is available!');
    console.log('Available topics:', topics);
    
    if (!topics.includes('movies_topic') || !topics.includes('tvshows_topic')) {
      console.log('\nRequired topics not found. Creating them...');
      
      const topicsToCreate = [];
      
      if (!topics.includes('movies_topic')) {
        topicsToCreate.push({
          topic: 'movies_topic',
          numPartitions: 1,
          replicationFactor: 1
        });
      }
      
      if (!topics.includes('tvshows_topic')) {
        topicsToCreate.push({
          topic: 'tvshows_topic',
          numPartitions: 1,
          replicationFactor: 1
        });
      }
      
      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate,
          waitForLeaders: true
        });
        console.log('Topics created successfully!');
      }
    }
    
    await admin.disconnect();
    return true;
  } catch (error) {
    console.error('Kafka broker is not available!');
    console.error('Error details:', error.message);
    console.error('\nPlease make sure:');
    console.error('1. Kafka is running on localhost:9092');
    console.error('2. Zookeeper is running and Kafka can connect to it');
    console.error('3. There are no firewall or network issues blocking the connection');
    
    await admin.disconnect();
    return false;
  }
};

checkKafka()
  .then(isAvailable => {
    if (isAvailable) {
      console.log('\nKafka setup is complete. You can now run the microservices.');
    } else {
      console.log('\nFix the Kafka issues before starting the microservices.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error during Kafka check:', error);
    process.exit(1);
  }); 