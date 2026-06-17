/*
 * Seed / enrich the `drivers` collection with an `earnings` sub-document so the
 * Flutter driver Earnings screen runs on real data from the live DB.
 *
 * - Idempotent: deterministic per-driver values, safe to re-run.
 * - Creates a `drivers` profile for any driver-role user that lacks one
 *   (e.g. the login account driver@gmail.com) and preserves existing profile
 *   fields for those that already have one.
 *
 * Usage:  node scripts/seed_driver_earnings.js
 */
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Small deterministic PRNG so the same driver always gets the same numbers.
function makeRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function buildEarnings(seed, ratePerDelivery) {
  const rng = makeRng(seed + 1);

  const weekly = DAYS.map((day) => {
    const deliveries = 3 + Math.floor(rng() * 12); // 3..14
    const amount = round2(deliveries * (ratePerDelivery + rng() * 1.6));
    return { day, amount, deliveries };
  });

  const weekTotal = round2(weekly.reduce((a, d) => a + d.amount, 0));
  const weekDeliveries = weekly.reduce((a, d) => a + d.deliveries, 0);
  // A few prior weeks of history baked into the lifetime totals.
  const priorWeeks = 6 + Math.floor(rng() * 10);
  const totalEarnings = round2(weekTotal * (priorWeeks + 1) * (0.85 + rng() * 0.3));
  const completedDeliveries = weekDeliveries * (priorWeeks + 1);
  const availableBalance = round2(weekTotal * (0.4 + rng() * 0.5));
  const rating = round2(4.2 + rng() * 0.7);
  const onlineSeconds = (38 + Math.floor(rng() * 12)) * 3600 + Math.floor(rng() * 3600);

  // Build a coherent recent-activity feed: a payout, a bonus, and the most
  // recent paid deliveries.
  const transactions = [
    {
      title: 'Cash out to wallet',
      subtitle: 'ABA · **** 4417',
      amount: -round2(availableBalance * 0.6 + 10),
      time: 'Today, 09:12',
      kind: 'payout',
      isPayout: true,
    },
    {
      title: 'Documents / Parcel',
      subtitle: 'Russian Market → Olympic',
      amount: round2(ratePerDelivery + 0.6),
      time: 'Today, 08:40',
      kind: 'delivery',
      isPayout: false,
    },
    {
      title: 'Food Items / Groceries',
      subtitle: 'Toul Kork → Boeung Kak 1',
      amount: round2(ratePerDelivery - 0.7),
      time: 'Yesterday, 19:05',
      kind: 'delivery',
      isPayout: false,
    },
    {
      title: 'Electronics / Gadgets',
      subtitle: 'Stueng Mean Chey → Sen Sok',
      amount: ratePerDelivery,
      time: 'Yesterday, 17:22',
      kind: 'delivery',
      isPayout: false,
    },
    {
      title: 'Weekend bonus',
      subtitle: '10+ deliveries on Saturday',
      amount: 5.0,
      time: 'Sat, 21:00',
      kind: 'bonus',
      isPayout: false,
    },
  ];

  return {
    currency: 'USD',
    ratePerDelivery,
    availableBalance,
    totalEarnings,
    completedDeliveries,
    rating,
    onlineSeconds,
    weekly,
    transactions,
    updatedAt: new Date(),
  };
}

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const drivers = db.collection('drivers');
  const users = db.collection('users');
  const branches = db.collection('branches');

  const driverUsers = await users.find({ role: 'driver' }).toArray();
  const fallbackBranch = await branches.findOne({});
  const fallbackBranchId = fallbackBranch?._id ?? null;

  console.log(`Found ${driverUsers.length} driver-role users.`);
  let created = 0;
  let updated = 0;

  for (let i = 0; i < driverUsers.length; i++) {
    const u = driverUsers[i];
    const ratePerDelivery = [3.0, 3.5, 4.0][i % 3];
    const earnings = buildEarnings(
      Number(u._id.toString().slice(-6), 16) || i + 1,
      ratePerDelivery,
    );

    const existing = await drivers.findOne({ userId: u._id });

    if (existing) {
      await drivers.updateOne(
        { _id: existing._id },
        { $set: { earnings, updatedAt: new Date() } },
      );
      updated++;
      console.log(`  ↻ updated earnings for ${u.email}`);
    } else {
      // Create a sensible profile for login drivers that have no `drivers` row.
      const vehicleType = ['MOTORCYCLE', 'CAR', 'TRUCK_LARGE'][i % 3];
      const plate = `PP-${1000 + i}${String.fromCharCode(65 + (i % 26))}`;
      await drivers.insertOne({
        userId: u._id,
        currentBranchId: fallbackBranchId,
        vehicleType,
        vehiclePlate: plate,
        status: 'AVAILABLE',
        isActive: true,
        shiftStart: 0,
        shiftEnd: 86399,
        preferredZones: ['SenSok', 'TuolKork'],
        earnings,
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
      });
      created++;
      console.log(`  ＋ created driver profile + earnings for ${u.email}`);
    }
  }

  console.log(`\nDone. Created ${created}, updated ${updated}.`);
  await client.close();
})().catch((e) => {
  console.error('SEED ERROR:', e.message);
  process.exit(1);
});
