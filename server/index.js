const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://ujjwaldhariwal0_db_user:zOwM7qramVvTJ0Ao@cluster0.wylldpr.mongodb.net/fuelify?retryWrites=true&w=majority",
  )
  .then(() => console.log("🟢 MongoDB Connected"))
  .catch((err) => console.error("🔴 MongoDB Error:", err));

const STATIONS = [
  { id: "1", name: "EagleStores Parma", lat: 41.38, lng: -81.73 },
  { id: "2", name: "Marathon Killbuck", lat: 40.5, lng: -81.98 },
  { id: "3", name: "Marathon Loudonville", lat: 40.63, lng: -82.23 },
  { id: "4", name: "Acro Akron", lat: 41.08, lng: -81.51 },
];

// SIMPLIFIED Schema - NO NESTED ARRAYS
const PriceHistorySchema = new mongoose.Schema(
  {
    stationId: String,
    date: String,
    time: String,
    updatedBy: String,
    regular: Number,
    midgrade: Number,
    premium: Number,
    diesel: Number,
  },
  { timestamps: true },
);

const PriceHistory = mongoose.model("PriceHistory", PriceHistorySchema);

app.get("/", (req, res) =>
  res.json({
    status: "Fuelify API + MongoDB ✅",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Failed",
    stations: STATIONS.length,
  }),
);

app.get("/api/stations", (req, res) => res.json(STATIONS));

app.post("/api/update-price", async (req, res) => {
  try {
    const { stationId, fuelType, price, updatedBy } = req.body;
    const now = new Date();

    // OVERWRITE today's record (SIMPLEST)
    await PriceHistory.findOneAndUpdate(
      { stationId, date: now.toISOString().split("T")[0] },
      {
        stationId,
        date: now.toISOString().split("T")[0],
        time: now.toISOString(),
        updatedBy: updatedBy || "Staff",
        [fuelType]: parseFloat(price),
      },
      { upsert: true, new: true },
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/price-history", async (req, res) => {
  try {
    const data = await PriceHistory.find({})
      .sort({ date: -1, time: -1 })
      .limit(120)
      .lean();

    // Group by date
    const historyByDate = {};
    data.forEach((doc) => {
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
    });

    res.json({ stations: STATIONS, history: historyByDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/chart-data/:stationId", async (req, res) => {
  const { stationId } = req.params;
  try {
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

    const station = STATIONS.find((s) => s.id === stationId);
    res.json({ station: station?.name, data: chartData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}`));
