const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 YOUR MONGODB URI
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ujjwaldhariwal0_db_user:zOwM7qramVvTJ0Ao@cluster0.wylldpr.mongodb.net/fuelify?retryWrites=true&w=majority')
  .then(() => console.log('🗄️ MongoDB Atlas Connected!'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Schemas
const PriceEntrySchema = new mongoose.Schema({
  time: { type: String, required: true },
  updatedBy: { type: String, required: true },
  prices: {
    regular: Number,
    midgrade: Number,
    premium: Number,
    diesel: Number
  }
});

const StationHistorySchema = new mongoose.Schema({
  stationId: { type: String, required: true },
  date: { type: String, required: true },
  entries: [PriceEntrySchema]
}, { timestamps: true });

const StationHistory = mongoose.model('StationHistory', StationHistorySchema);

// Static stations
const STATIONS = [
  { id: "1", name: "EagleStores Parma", lat: 41.38, lng: -81.73 },
  { id: "2", name: "Marathon Killbuck", lat: 40.50, lng: -81.98 },
  { id: "3", name: "Marathon Loudonville", lat: 40.63, lng: -82.23 },
  { id: "4", name: "Acro Akron", lat: 41.08, lng: -81.51 }
];

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Fuelify API + MongoDB Atlas ✅', 
    mongodb: 'Connected',
    stations: STATIONS.length 
  });
});

app.get('/api/stations', (req, res) => {
  res.json(STATIONS);
});

app.post('/api/update-price', async (req, res) => {
  try {
    const { stationId, fuelType, price, updatedBy } = req.body;
    
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const timeKey = now.toISOString();

    // Find today's record or create new
    let history = await StationHistory.findOne({ stationId, date: dateKey });
    if (!history) {
      history = new StationHistory({
        stationId, date: dateKey, entries: []
      });
    }

    // Get latest entry or create
    let latestEntry = history.entries[0];
    if (!latestEntry) {
      latestEntry = {
        time: timeKey,
        updatedBy: updatedBy || "Staff",
        prices: { regular: null, midgrade: null, premium: null, diesel: null }
      };
      history.entries.unshift(latestEntry);
    }

    // Update price
    latestEntry.prices[fuelType] = parseFloat(price);
    latestEntry.time = timeKey;
    latestEntry.updatedBy = updatedBy || "Staff";

    await history.save();
    console.log(`✅ MongoDB: ${fuelType} $${price} saved`);

    res.json({ success: true, dateKey, stationId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Save failed" });
  }
});

app.get('/api/admin/price-history', async (req, res) => {
  try {
    const histories = await StationHistory.find({})
      .sort({ date: -1 })
      .limit(120);

    const historyByDate = {};
    histories.forEach(doc => {
      if (!historyByDate[doc.date]) historyByDate[doc.date] = {};
      historyByDate[doc.date][doc.stationId] = [doc.entries[0]];
    });

    res.json({
      stations: STATIONS,
      history: historyByDate
    });
  } catch (err) {
    res.status(500).json({ error: "History failed" });
  }
});

app.get('/api/admin/chart-data/:stationId', async (req, res) => {
  const { stationId } = req.params;
  try {
    const histories = await StationHistory.find({ stationId })
      .sort({ date: 1 })
      .limit(30);

    const chartData = histories.map(doc => ({
      date: doc.date,
      regular: doc.entries[0]?.prices?.regular || null,
      midgrade: doc.entries[0]?.prices?.midgrade || null,
      premium: doc.entries[0]?.prices?.premium || null,
      diesel: doc.entries[0]?.prices?.diesel || null
    }));

    const station = STATIONS.find(s => s.id === stationId);
    res.json({
      station: station?.name || 'Unknown',
      data: chartData
    });
  } catch (err) {
    res.status(500).json({ error: "Chart failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Fuelify + MongoDB Atlas on ${PORT}`));
