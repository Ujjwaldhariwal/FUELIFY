const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 IN-MEMORY DATABASE - PERSISTENT ACROSS REQUESTS
let database = {
  stations: [
    { id: "1", name: "EagleStores Parma", lat: 41.38, lng: -81.73 },
    { id: "2", name: "Marathon Killbuck", lat: 40.50, lng: -81.98 },
    { id: "3", name: "Marathon Loudonville", lat: 40.63, lng: -82.23 },
    { id: "4", name: "Acro Akron", lat: 41.08, lng: -81.51 }
  ],
  priceHistory: {}
};

console.log('🚀 Database initialized with 4 stations');

// --- ENDPOINTS ---

app.get('/api/stations', (req, res) => {
  console.log('📡 GET /api/stations');
  res.json(database.stations);
});

app.post('/api/update-price', (req, res) => {
  const { stationId, fuelType, price, updatedBy } = req.body;
  console.log(`📝 Update price: ${stationId} ${fuelType}=$${price}`);

  if (!stationId || !price || !fuelType) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const station = database.stations.find(s => s.id === stationId);
  if (!station) return res.status(404).json({ error: "Station not found" });

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const timeKey = now.toISOString();

  // Initialize date structure
  if (!database.priceHistory[dateKey]) database.priceHistory[dateKey] = {};
  if (!database.priceHistory[dateKey][stationId]) database.priceHistory[dateKey][stationId] = [];

  // Get or create today's entry
  let todayEntry = database.priceHistory[dateKey][stationId][0];
  if (!todayEntry) {
    todayEntry = {
      time: timeKey,
      updatedBy: updatedBy || "Staff",
      prices: { regular: null, midgrade: null, premium: null, diesel: null }
    };
    database.priceHistory[dateKey][stationId].unshift(todayEntry);
  }

  // Update specific fuel type
  todayEntry.prices[fuelType] = parseFloat(price);
  todayEntry.time = timeKey;
  todayEntry.updatedBy = updatedBy || "Staff";

  console.log(`✅ Saved ${fuelType}=$${price} for ${station.name}`);
  res.json({ success: true, dateKey, stationId });
});

app.get('/api/admin/price-history', (req, res) => {
  console.log('📊 GET /api/admin/price-history');
  
  const dates = Object.keys(database.priceHistory).sort().reverse().slice(0, 30);
  const history = {};
  dates.forEach(date => {
    history[date] = database.priceHistory[date];
  });
  
  console.log(`📈 History dates: ${dates.length}`);
  res.json({
    stations: database.stations,
    history: history
  });
});

app.get('/api/admin/chart-data/:stationId', (req, res) => {
  const { stationId } = req.params;
  console.log(`📈 Chart data for station: ${stationId}`);
  
  const station = database.stations.find(s => s.id === stationId);
  if (!station) return res.status(404).json({ error: "Station not found" });

  const dates = Object.keys(database.priceHistory).sort().reverse().slice(0, 30);
  const chartData = dates.map(date => {
    const stationData = database.priceHistory[date]?.[stationId]?.[0];
    return {
      date,
      regular: stationData?.prices?.regular || null,
      midgrade: stationData?.prices?.midgrade || null,
      premium: stationData?.prices?.premium || null,
      diesel: stationData?.prices?.diesel || null
    };
  }).reverse();

  console.log(`📊 Chart data points: ${chartData.length}`);
  res.json({
    station: station.name,
    data: chartData
  });
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Fuelify API running!', endpoints: ['/api/stations', '/api/admin/price-history'] });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`🌐 Test: http://localhost:${PORT}/api/stations`);
});
