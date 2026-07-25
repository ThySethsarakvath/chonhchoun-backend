const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

function readEnvFile(filePath) {
  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    env[key] = value;
  }
  return env;
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = readEnvFile(envPath);
  const client = new MongoClient(env.MONGODB_URI);

  await client.connect();
  const db = client.db();

  const deletedShipments = await db
    .collection('branchlogisticsshipments')
    .deleteMany({});
  const deletedWalletTransactions = await db
    .collection('branchwallettransactions')
    .deleteMany({});
  const resetWallets = await db.collection('branchwallets').updateMany(
    {},
    {
      $set: {
        availableBalance: 0,
        pendingBalance: 0,
        totalCredited: 0,
        totalDebited: 0,
      },
    },
  );

  console.log(
    JSON.stringify(
      {
        deletedShipments: deletedShipments.deletedCount,
        deletedWalletTransactions: deletedWalletTransactions.deletedCount,
        resetWallets: resetWallets.modifiedCount,
      },
      null,
      2,
    ),
  );

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
