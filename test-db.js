const mongoose = require('mongoose');

const uri = "mongodb+srv://ratanak:aUp7zPvHbeuycFMi@ac-ab39qik.rpglsnl.mongodb.net/chonhchoun?retryWrites=true&w=majority";

async function run() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB!");
  
  const PackageSchema = new mongoose.Schema({}, { strict: false });
  const Package = mongoose.model('Package', PackageSchema, 'packages');
  
  const packages = await Package.find({}).sort({ createdAt: -1 }).limit(5);
  console.log("Total packages count:", await Package.countDocuments({}));
  console.log("Pending packages count:", await Package.countDocuments({ status: "PENDING" }));
  
  console.log("Last 5 packages:");
  packages.forEach(pkg => {
    console.log(`- ID: ${pkg._id}, Tracking: ${pkg.trackingNumber}, Status: ${pkg.status}, vehicleType: ${pkg.vehicleType}, customerId: ${pkg.customerId}`);
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
