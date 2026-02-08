const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Disable buffering globally
mongoose.set("bufferCommands", false);

// ============================================================
// 📍 STATION CONFIGURATION (Verified Coordinates)
// ============================================================
const STATIONS = [
  // ID 1: EagleStores (Placeholder / Admin Test Store)
  { 
    id: "1", 
    name: "EagleStores Parma", 
    lat: 41.38, 
    lng: -81.73, 
    address: "5555 Broadview Rd, Parma, OH 44134" 
  },
  // ID 2: Killbuck Marathon
  { 
    id: "2", 
    name: "Killbuck Marathon", 
    lat: 40.494994, 
    lng: -81.985704, 
    address: "205 W Front St, Killbuck, OH 44637" 
  },
  // ID 3: Loudonville Marathon
  { 
    id: "3", 
    name: "Loudonville Marathon", 
    lat: 40.637842, 
    lng: -82.230366, 
    address: "236 N Union St, Loudonville, OH 44842" 
  },
  // ID 4: ARCO Akron
  { 
    id: "4", 
    name: "ARCO East Ave", 
    lat: 41.043609, 
    lng: -81.572290, 
    address: "2215 East Ave, Akron, OH 44314" 
  },
   {
    id: "5",
    name: "Eagle Store Winchester",
    brand: "shell", // 3480 Gender Rd is a Shell station
    lat: 39.911230,
    lng: -82.823660,
    address: "3480 Gender Rd, Canal Winchester, OH 43110"
  }
];

// ============================================================
// 🗄️ DATABASE SCHEMA
// ============================================================
const PriceHistorySchema = new mongoose.Schema(
  {
    stationId: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    updatedBy: { type: String, default: "Staff" },
    regular: { type: Number, default: null },
    midgrade: { type: Number, default: null },
    premium: { type: Number, default: null },
    diesel: { type: Number, default: null },
  },
  {
    timestamps: true,
    bufferCommands: false,
    autoCreate: false, 
  }
);

const PriceHistory = mongoose.model("PriceHistory", PriceHistorySchema);

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

// ============================================================
// 🌐 API ROUTES
// ============================================================

app.get("/", (req, res) => {
  res.json({
    status: "Fuelify API",
    mongodb: isDbReady() ? "Connected" : "Not connected",
    stations: STATIONS.length,
  });
});

// ✅ UPDATED: Returns Stations WITH Latest Prices
app.get("/api/stations", async (req, res) => {
  try {
    // If DB is down, return basic info with zero prices
    if (!isDbReady()) {
      return res.json(STATIONS.map(s => ({
        ...s,
        prices: { regular: 0, midgrade: 0, premium: 0, diesel: 0 },
        lastUpdated: "Offline"
      })));
    }

    // Fetch latest prices for all stations in parallel
    const stationsWithPrices = await Promise.all(
      STATIONS.map(async (station) => {
        // Find the absolute latest price entry (descending sort)
        const latestPrice = await PriceHistory.findOne({ stationId: station.id })
          .sort({ date: -1, time: -1 }) 
          .lean();

        return {
          ...station,
          prices: {
            regular: latestPrice?.regular || 0,
            midgrade: latestPrice?.midgrade || 0,
            premium: latestPrice?.premium || 0,
            diesel: latestPrice?.diesel || 0,
          },
          lastUpdated: latestPrice?.time || "Never"
        };
      })
    );

    res.json(stationsWithPrices);
  } catch (err) {
    console.error("Station fetch error:", err);
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

// Update Price (Admin Panel)
app.post("/api/update-price", async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: "DB not connected" });

  try {
    const { stationId, fuelType, price, updatedBy } = req.body;
    const now = new Date();
    const dateKey = now.toISOString().split("T")[0];

    const filter = { stationId: String(stationId), date: dateKey };
    const update = {
      $set: {
        time: now.toISOString(),
        updatedBy: updatedBy || "Staff",
        [fuelType]: parseFloat(price),
      },
    };

    // Upsert: Update if exists for today, else create new
    await PriceHistory.updateOne(filter, update, { upsert: true });

    res.json({ success: true, dateKey, stationId: String(stationId) });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Dashboard Data
app.get("/api/admin/price-history", async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: "DB not connected" });
  try {
    const data = await PriceHistory.find({})
      .sort({ date: -1, time: -1 })
      .limit(120)
      .lean();

    const historyByDate = {};
    for (const doc of data) {
      if (!historyByDate[doc.date]) historyByDate[doc.date] = {};
      historyByDate[doc.date][doc.stationId] = [
        {
          time: doc.time,
          updatedBy: doc.updatedBy,
          prices: {
            regular: doc.regular,
            midgrade: doc.midgrade,
            premium: doc.premium,
            diesel: doc.diesel,
          },
        },
      ];
    }
    res.json({ stations: STATIONS, history: historyByDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chart Data Endpoint
app.get("/api/admin/chart-data/:stationId", async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: "DB not connected" });
  try {
    const { stationId } = req.params;
    const station = STATIONS.find((s) => s.id === stationId);
    if (!station) return res.status(404).json({ error: "Station not found" });

    const data = await PriceHistory.find({ stationId })
      .sort({ date: 1 })
      .limit(30)
      .lean();

    const chartData = data.map((doc) => ({
      date: doc.date,
      regular: doc.regular,
      midgrade: doc.midgrade,
      premium: doc.premium,
      diesel: doc.diesel,
    }));

    res.json({ station: station.name, data: chartData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 🚀 SERVER STARTUP
// ============================================================
async function startServer() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI not set!");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
    });
    console.log("🟢 MongoDB Connected");
    console.log("🟢 DB Ready state: " + mongoose.connection.readyState);

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

  } catch (err) {
    console.error("🔴 Failed to connect/start:", err);
    process.exit(1);
  }
}

startServer();
