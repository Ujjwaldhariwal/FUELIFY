import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Save,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  BarChart3,
  Table as TableIcon
} from 'lucide-react';

// --- CONFIG ---
const API_URL = 'https://fuelify.onrender.com';

// --- TYPES ---
interface Station {
  id: string;
  name: string;
}

interface PriceEntry {
  time: string;
  updatedBy: string;
  prices: {
    regular: number | null;
    midgrade: number | null;
    premium: number | null;
    diesel: number | null;
  };
}

interface DateHistory {
  [stationId: string]: PriceEntry[];
}

interface AdminData {
  stations: Station[];
  history: {
    [date: string]: DateHistory;
  };
}

interface ChartDataPoint {
  date: string;
  regular: number | null;
  midgrade: number | null;
  premium: number | null;
  diesel: number | null;
}

// --- TOAST ---
const Toast = ({ msg, type }: { msg: string; type: 'success' | 'error' }) => (
  <div
    className={`fixed top-6 right-6 px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50 ${
      type === 'success'
        ? 'bg-emerald-600 text-white'
        : 'bg-red-500 text-white'
    }`}
  >
    {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
    <span className="font-bold">{msg}</span>
  </div>
);

// ================= STAFF PAGE =================

// ================= STAFF PAGE =================
function StaffPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState('');
  const [staffName, setStaffName] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);

  const [prices, setPrices] = useState({
    regular: '',
    midgrade: '',
    premium: '',
    diesel: ''
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/stations`);
        if (mounted) setStations(res.data);
      } catch (err) {
        console.error('Failed to load stations', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const showNotify = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Blocks 'e', 'E', '+', and '-' in price fields
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stationId) return showNotify('Please select a store first', 'error');
    if (!staffName.trim()) return showNotify('Staff name is required', 'error');

    // VALIDATION: Ensure ALL prices are entered and greater than 0
    const priceKeys = Object.keys(prices) as (keyof typeof prices)[];
    const allPricesEntered = priceKeys.every(key => 
      prices[key] !== '' && Number(prices[key]) > 0
    );

    if (!allPricesEntered) {
      return showNotify('Please enter all four fuel prices before submitting', 'error');
    }

    setLoading(true);

    try {
      await Promise.all(
        priceKeys.map((fuelType) =>
          axios.post(`${API_URL}/api/update-price`, {
            stationId,
            updatedBy: staffName,
            fuelType,
            price: prices[fuelType]
          })
        )
      );

      showNotify('All Prices Updated Successfully!', 'success');
      // Reset only prices, NOT the staff name
      setPrices({ regular: '', midgrade: '', premium: '', diesel: '' });
    } catch (err) {
      console.error(err);
      showNotify('Failed to submit prices', 'error');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {notification && <Toast {...notification} />}

      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-3xl font-bold mb-8 text-center text-slate-800">Set Fuel Prices</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Location</label>
            <select
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
            >
              <option value="">Choose Store...</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
            <input
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Enter your name"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {(['regular', 'midgrade', 'premium', 'diesel'] as const).map((type) => (
              <div key={type}>
                <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{type} Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    onKeyDown={handleKeyDown}
                    placeholder={`0.00`}
                    className="w-full p-3 pl-7 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={prices[type]}
                    onChange={(e) =>
                      setPrices((p) => ({ ...p, [type]: e.target.value }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex justify-center gap-2 items-center hover:bg-blue-700 transition-colors disabled:opacity-50 mt-4 shadow-lg shadow-blue-200"
          >
            {loading ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
            {loading ? 'Updating Database...' : 'Submit All Prices'}
          </button>
        </form>

     
      </div>
    </div>
  );
}

// ... (Rest of the AdminPage and App code remains the same)
// ================= ADMIN PAGE WITH TWO VIEWS =================
function AdminPage() {
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [view, setView] = useState<'table' | 'chart'>('table');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [chartData, setChartData] = useState<ChartDataPoint[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/price-history`);
      setAdminData(res.data);
      
      // Set default date to most recent
      const dates = Object.keys(res.data.history).sort().reverse();
      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0]);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    }
    setRefreshing(false);
  }, [selectedDate]);

  const fetchChartData = useCallback(async (stationId: string) => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/chart-data/${stationId}`);
      setChartData(res.data.data);
    } catch (err) {
      console.error('Failed to load chart data', err);
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      if (active) await fetchAdminData();
    })();

    const interval = setInterval(() => {
      fetchAdminData();
    }, 10000); // Refresh every 10 seconds

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchAdminData]);

const lastFetchedStation = React.useRef<string | null>(null);

useEffect(() => {
  if (
    view === 'chart' &&
    selectedStation &&
    lastFetchedStation.current !== selectedStation
  ) {
    lastFetchedStation.current = selectedStation;
    setTimeout(() => {
      fetchChartData(selectedStation);
    }, 0);
  }
}, [view, selectedStation, fetchChartData]);



  if (!adminData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <RefreshCw className="animate-spin text-white" size={32} />
      </div>
    );
  }

  const dates = Object.keys(adminData.history).sort().reverse();
  const currentDateData = selectedDate ? adminData.history[selectedDate] : null;

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="text-emerald-400" size={24} />
            Admin Dashboard
          </h1>
          <div className="flex gap-4">
            <Link
              to="/"
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
            >
              Back to Form
            </Link>
            <button
              onClick={fetchAdminData}
              className={`p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all ${
                refreshing ? 'animate-spin' : ''
              }`}
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              view === 'table'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <TableIcon size={18} />
            Table View
          </button>
          <button
            onClick={() => setView('chart')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              view === 'chart'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <BarChart3 size={18} />
            Chart View
          </button>
        </div>

        {/* TABLE VIEW */}
        {view === 'table' && (
          <div className="space-y-6">
            {/* Date Selector */}
            <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-lg">
              <Calendar className="text-slate-400" size={20} />
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 bg-slate-900 text-white p-2 rounded border border-slate-700"
              >
                {dates.map((date) => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Table */}
            {currentDateData && (
              <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="p-5">Station</th>
                      <th className="p-5">Last Updated</th>
                      <th className="p-5">Updated By</th>
                      <th className="p-5 text-right">Regular</th>
                      <th className="p-5 text-right">Midgrade</th>
                      <th className="p-5 text-right">Premium</th>
                      <th className="p-5 text-right">Diesel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {adminData.stations.map((station) => {
                      const stationData = currentDateData[station.id]?.[0];
                      return (
                        <tr key={station.id} className="hover:bg-slate-700/50 transition-colors text-slate-300">
                          <td className="p-5 font-bold text-white">{station.name}</td>
                          <td className="p-5 font-mono text-sm text-slate-400">
                            {stationData
                              ? new Date(stationData.time).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'No data'}
                          </td>
                          <td className="p-5">
                            <span className="bg-slate-900 px-2 py-1 rounded text-xs border border-slate-600">
                              {stationData?.updatedBy || 'N/A'}
                            </span>
                          </td>
                          <td className="p-5 text-right font-mono font-bold text-emerald-400">
                            {stationData?.prices.regular ? `$${stationData.prices.regular.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-5 text-right font-mono font-bold text-emerald-400">
                            {stationData?.prices.midgrade ? `$${stationData.prices.midgrade.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-5 text-right font-mono font-bold text-emerald-400">
                            {stationData?.prices.premium ? `$${stationData.prices.premium.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-5 text-right font-mono font-bold text-emerald-400">
                            {stationData?.prices.diesel ? `$${stationData.prices.diesel.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CHART VIEW */}
        {view === 'chart' && (
          <div className="space-y-6">
            {/* Station Selector */}
            <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-lg">
              <Database className="text-slate-400" size={20} />
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="flex-1 bg-slate-900 text-white p-2 rounded border border-slate-700"
              >
                <option value="">Select a station</option>
                {adminData.stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chart Display */}
            {chartData && selectedStation && (
              <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-6">
                  Price History - {adminData.stations.find(s => s.id === selectedStation)?.name}
                </h2>
                <div className="space-y-3">
                  {chartData.reverse().map((point, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-lg">
                      <div className="w-24 text-slate-400 font-mono text-sm">
                        {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1 grid grid-cols-4 gap-4">
                        {['regular', 'midgrade', 'premium', 'diesel'].map((type) => {
                          const price = point[type as keyof Omit<ChartDataPoint, 'date'>];
                          return (
                            <div key={type} className="text-center">
                              <div className="text-xs text-slate-500 uppercase mb-1">{type}</div>
                              <div className="text-lg font-bold text-emerald-400">
                                {price ? `$${price.toFixed(2)}` : '-'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!selectedStation && (
              <div className="bg-slate-800 rounded-2xl p-12 text-center text-slate-400 border border-slate-700">
                Select a station to view price history chart
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ================= APP =================
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StaffPage />} />
        <Route path="/admin-view" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}
