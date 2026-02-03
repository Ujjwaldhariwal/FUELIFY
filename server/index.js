const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// Disable mongoose buffering globally (prevents 10s "buffering timed out" waits)
mongoose.set("bufferCommands", false); // [page:1]

const STATIONS = [
  { id: "1", name: "EagleStores Parma", lat: 41.38, lng: -81.73 },
  { id: "2", name: "Marathon Killbuck", lat: 40.5, lng: -81.98 },
  { id: "3", name: "Marathon Loudonville", lat: 40.63, lng: -82.23 },
  { id: "4", name: "Acro Akron", lat: 41.08, lng: -81.51 },
];

// Flat schema (your current structure)
const PriceHistorySchema = new mongoose.Schema(
  {
    stationId: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // ISO string
    updatedBy: { type: String, default: "Staff" },
    regular: { type: Number, default: null },
    midgrade: { type: Number, default: null },
    premium: { type: Number, default: null },
    diesel: { type: Number, default: null },
  },
  {
    timestamps: true,
    bufferCommands: false, // also disable at schema level [page:1]
  }
);

// Prevent duplicate docs for same station/day
PriceHistorySchema.index({ stationId: 1, date: 1 }, { unique: true });

const PriceHistory = mongoose.model("PriceHistory", PriceHistorySchema);

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

// If DB is not ready, fail fast for API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api") && !isDbReady()) {
    return res.status(503).json({ error: "DB not ready, try again in a few seconds" });
  }
  next();
});

app.get("/", (req, res) => {
  res.json({
    status: "Fuelify API",
    mongodbReadyState: mongoose.connection.readyState, // 1=connected
    mongodb: isDbReady() ? "Connected" : "Not connected",
    stations: STATIONS.length,
    envUriSet: Boolean(process.env.MONGODB_URI),
  });
});

app.get("/api/stations", (req, res) => res.json(STATIONS));

app.post("/api/update-price", async (req, res) => {
  try {
    const { stationId, fuelType, price, updatedBy } = req.body;

    if (!stationId || !fuelType || price === undefined || price === null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (!["regular", "midgrade", "premium", "diesel"].includes(fuelType)) {
      return res.status(400).json({ error: "Invalid fuelType" });
    }

    const stationExists = STATIONS.some((s) => s.id === String(stationId));
    if (!stationExists) return res.status(404).json({ error: "Station not found" });

    const now = new Date();
    const dateKey = now.toISOString().split("T")[0];
    const timeKey = now.toISOString();
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: "Invalid price" });
    }

    // IMPORTANT: use $set so parallel requests don't replace the whole doc
    const filter = { stationId: String(stationId), date: dateKey };
    const update = {
      $setOnInsert: { stationId: String(stationId), date: dateKey },
      $set: {
        time: timeKey,
        updatedBy: (updatedBy || "Staff").trim(),
        [fuelType]: numericPrice,
      },
    };

    try {
      await PriceHistory.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }).lean();
    } catch (err) {
      // If 4 parallel upserts collide, one may hit duplicate key error. Retry once.
      if (err && err.code === 11000) {
        await PriceHistory.findOneAndUpdate(filter, update, { upsert: false }).lean();
      } else {
        throw err;
      }
    }

    res.json({ success: true, dateKey, stationId: String(stationId) });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: err.message || "Save failed" });
  }
});

app.get("/api/admin/price-history", async (req, res) => {
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
            regular: doc.regular ?? null,
            midgrade: doc.midgrade ?? null,
            premium: doc.premium ?? null,
            diesel: doc.diesel ?? null,
          },
        },
      ];
    }

    res.json({ stations: STATIONS, history: historyByDate });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/chart-data/:stationId", async (req, res) => {
  const { stationId } = req.params;
  try {
    const station = STATIONS.find((s) => s.id === String(stationId));
    if (!station) return res.status(404).json({ error: "Station not found" });

    const data = await PriceHistory.find({ stationId: String(stationId) })
      .sort({ date: 1 })
      .limit(30)
      .lean();

    const chartData = data.map((doc) => ({
      date: doc.date,
      regular: doc.regular ?? null,
      midgrade: doc.midgrade ?? null,
      premium: doc.premium ?? null,
      diesel: doc.diesel ?? null,
    }));

    res.json({ station: station.name, data: chartData });
  } catch (err) {
    console.error("Chart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Start server ONLY after DB connection ----
async function start() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI missing. Set it in Render Environment Variables.");
    process.exit(1);
  }

  mongoose.connection.on("connected", () => console.log("🟢 Mongo connected"));
  mongoose.connection.on("disconnected", () => console.log("🟠 Mongo disconnected"));
  mongoose.connection.on("error", (e) => console.log("🔴 Mongo error:", e?.message || e));

  // Connection options (timeouts + prefer IPv4). [page:1]
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
  });

  // Ensure indexes exist (unique stationId+date)
  await PriceHistory.init();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
}

start().catch((err) => {
  console.error("❌ Failed to start:", err);
  process.exit(1);
});
