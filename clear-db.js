const mongoose = require('mongoose');

// Direct shard URI to bypass SRV resolution blocks
const uri = "mongodb://ratanak:aUp7zPvHbeuycFMi@ac-ab39qik-shard-00-00.rpglsnl.mongodb.net:27017,ac-ab39qik-shard-00-01.rpglsnl.mongodb.net:27017,ac-ab39qik-shard-00-02.rpglsnl.mongodb.net:27017/chonhchoun?ssl=true&replicaSet=atlas-m1w9i2-shard-0&authSource=admin&retryWrites=true&w=majority";

async function run() {
  console.log("Connecting directly to MongoDB shards...");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB!");
  
  const PackageSchema = new mongoose.Schema({}, { strict: false });
  const Package = mongoose.model('Package', PackageSchema, 'packages');
  
  const countBefore = await Package.countDocuments({});
  console.log(`Current packages count: ${countBefore}`);
  
  if (countBefore > 0) {
    const result = await Package.deleteMany({});
    console.log(`Successfully deleted ${result.deletedCount} packages.`);
  } else {
    console.log("No packages to delete.");
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
