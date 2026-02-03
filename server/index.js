const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// --- CLEAN DATABASE UTILS ---
let cachedDB = null;

function getDatabase() {
  if (cachedDB) return cachedDB;

  if (!fs.existsSync(DB_FILE)) {
    // CLEAN INITIAL DATA - ONLY NEW STRUCTURE
    const initialData = {
      stations: [
        { id: "1", name: "EagleStores Parma", lat: 41.38, lng: -81.73 },
        { id: "2", name: "Marathon Killbuck", lat: 40.50, lng: -81.98 },
        { id: "3", name: "Marathon Loudonville", lat: 40.63, lng: -82.23 },
        { id: "4", name: "Acro Akron", lat: 41.08, lng: -81.51 }
      ],
      priceHistory: {} // NEW STRUCTURE ONLY
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    cachedDB = initialData;
    return cachedDB;
  }

  try {
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(rawData);
    
    // CLEANUP OLD DATA
    if (data.history) {
      console.log('🧹 Removing old history array...');
      delete data.history;
    }
    if (data.stations) {
      data.stations.forEach((station) => {  // ✅ REMOVED :any TYPE ANNOTATION
        delete station.prices; // Remove old prices from stations
      });
    }
    
    if (!data.priceHistory) data.priceHistory = {};
    cachedDB = data;
    return cachedDB;
  } catch (err) {
    console.error('Database corrupted, recreating...', err);
    // Recreate clean file
    const initialData = {
      stations: [
        { id: "1", name: "EagleStores Parma", lat: 41.38, lng: -81.73 },
        { id: "2", name: "Marathon Killbuck", lat: 40.50, lng: -81.98 },
        { id: "3", name: "Marathon Loudonville", lat: 40.63, lng: -82.23 },
        { id: "4", name: "Acro Akron", lat: 41.08, lng: -81.51 }
      ],
      priceHistory: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    cachedDB = initialData;
    return cachedDB;
  }
}

function saveDatabase(data) {
  cachedDB = data;
  // SYNCHRONOUS WRITE for safety during development
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

// --- ENDPOINTS ---

app.get('/api/stations', (req, res) => {
  try {
    const db = getDatabase();
    res.json(db.stations);
  } catch (err) {
    res.status(500).json({ error: "Failed to load stations" });
  }
});

app.post('/api/update-price', (req, res) => {
  const { stationId, fuelType, price, updatedBy } = req.body;

  if (!stationId || !price || !fuelType) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const db = getDatabase();
  const station = db.stations.find(s => s.id == stationId);

  if (!station) return res.status(404).json({ error: "Station not found" });

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const timeKey = now.toISOString();

  // Initialize date structure
  if (!db.priceHistory[dateKey]) {
    db.priceHistory[dateKey] = {};
  }
  if (!db.priceHistory[dateKey][stationId]) {
    db.priceHistory[dateKey][stationId] = [];
  }

  // Get or create today's entry
  let todayEntry = db.priceHistory[dateKey][stationId][0];
  if (!todayEntry) {
    todayEntry = {
      time: timeKey,
      updatedBy: updatedBy || "Staff",
      prices: { regular: null, midgrade: null, premium: null, diesel: null }
    };
    db.priceHistory[dateKey][stationId].unshift(todayEntry);
  }

  // Update specific fuel type
  todayEntry.prices[fuelType] = parseFloat(price);
  todayEntry.time = timeKey;
  todayEntry.updatedBy = updatedBy || "Staff";

  saveDatabase(db);
  res.json({ success: true, dateKey, stationId });
});

app.get('/api/admin/price-history', (req, res) => {
  try {
    const db = getDatabase();
    const dates = Object.keys(db.priceHistory).sort().reverse().slice(0, 30);
    const history = {};
    dates.forEach(date => {
      history[date] = db.priceHistory[date];
    });
    res.json({
      stations: db.stations,
      history: history
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load price history" });
  }
});

app.get('/api/admin/chart-data/:stationId', (req, res) => {
  try {
    const { stationId } = req.params;
    const db = getDatabase();
    const station = db.stations.find(s => s.id === stationId);

    if (!station) return res.status(404).json({ error: "Station not found" });

    const dates = Object.keys(db.priceHistory).sort().reverse().slice(0, 30);
    const chartData = dates.map(date => {
      const stationData = db.priceHistory[date]?.[stationId]?.[0];
      return {
        date,
        regular: stationData?.prices?.regular || null,
        midgrade: stationData?.prices?.midgrade || null,
        premium: stationData?.prices?.premium || null,
        diesel: stationData?.prices?.diesel || null
      };
    }).reverse();

    res.json({
      station: station.name,
      data: chartData
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load chart data" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
