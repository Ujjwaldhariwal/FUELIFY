const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// --- DATABASE UTILS ---
function getDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    // Default Data
    const initialData = {
      stations: [
        { id: 1, name: "Shell - Downtown", lat: 32.7767, lng: -96.7970, prices: { regular: 2.50, midgrade: 2.80, premium: 3.10, diesel: 3.00 } },
        { id: 2, name: "Chevron - North Hwy", lat: 32.7900, lng: -96.8100, prices: { regular: 2.65, midgrade: 2.95, premium: 3.25, diesel: 3.15 } },
        { id: 3, name: "Exxon - West Ave", lat: 32.7600, lng: -96.7800, prices: { regular: 2.45, midgrade: 2.75, premium: 3.05, diesel: 2.95 } }
      ],
      history: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- ENDPOINTS ---

// 1. Get All Data
app.get('/api/stations', (req, res) => {
  const db = getDatabase();
  res.json(db.stations);
});

// 2. Get History
app.get('/api/history', (req, res) => {
  const db = getDatabase();
  res.json(db.history.reverse());
});

// 3. Update Price
app.post('/api/update-price', (req, res) => {
  const { stationId, prices, user } = req.body;
  const db = getDatabase();
  const index = db.stations.findIndex(s => s.id == stationId);

  if (index === -1) return res.status(404).json({ error: "Station not found" });

  // Update
  db.stations[index].prices = { ...db.stations[index].prices, ...prices };

  // Log
  const log = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    stationName: db.stations[index].name,
    updatedBy: user || "Staff",
    type: 'PRICE_UPDATE',
    details: prices
  };
  db.history.push(log);
  
  saveDatabase(db);
  // Simulate network delay for realism
  setTimeout(() => res.json({ success: true, log }), 500);
});

// 4. Register Station
app.post('/api/stations', (req, res) => {
  const { name, lat, lng } = req.body;
  if (!name || !lat || !lng) return res.status(400).json({ error: "Missing fields" });

  const db = getDatabase();
  const newStation = {
    id: Date.now(),
    name,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    prices: { regular: 0, midgrade: 0, premium: 0, diesel: 0 }
  };

  db.stations.push(newStation);

  // Log
  db.history.push({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    stationName: name,
    updatedBy: "System Admin",
    type: 'REGISTRATION',
    details: { lat, lng }
  });

  saveDatabase(db);
  setTimeout(() => res.json({ success: true, station: newStation }), 500);
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
