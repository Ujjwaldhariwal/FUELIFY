import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Map as MapIcon, 
  Settings, 
  TrendingUp, 
  Database, 
  PlusCircle, 
  Save, 
  Navigation, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Menu
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
// --- LEAFLET ICON FIX ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const API_URL = 'https://fuelify.onrender.com';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- TYPES ---
interface Prices {
  regular: string | number;
  midgrade: string | number;
  premium: string | number;
  diesel: string | number;
}

interface Station {
  id: number;
  name: string;
  lat: number;
  lng: number;
  prices: Prices;
}

interface LogEntry {
  id: number;
  timestamp: string;
  stationName: string;
  updatedBy: string;
  type: 'PRICE_UPDATE' | 'REGISTRATION';
  details: any;
}

// --- COMPONENT: TOAST NOTIFICATION ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`absolute top-12 left-1/2 transform -translate-x-1/2 w-[90%] p-3 rounded-lg shadow-lg flex items-center gap-3 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300 ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'}`}>
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

// --- COMPONENT: PHONE FRAME ---
interface PhoneFrameProps {
  children: React.ReactNode;
  statusBarTime: string;
}

const PhoneFrame: React.FC<PhoneFrameProps> = ({ children, statusBarTime }) => (
  <div className="relative mx-auto border-gray-900 bg-gray-900 border-[12px] rounded-[3rem] h-[720px] w-[350px] shadow-2xl overflow-hidden ring-4 ring-gray-900/40">
    {/* Dynamic Island / Notch */}
    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-b-2xl z-50 flex justify-center items-center">
        <div className="w-16 h-2 bg-gray-800 rounded-full opacity-50"></div>
    </div>
    
    {/* Status Bar */}
    <div className="absolute top-0 left-0 w-full h-[44px] bg-white z-40 flex justify-between items-center px-6 pt-2 text-black text-xs font-semibold select-none">
      <span>{statusBarTime}</span>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4"><SignalIcon /></div>
        <div className="w-4 h-4"><WifiIcon /></div>
        <div className="w-5"><BatteryIcon /></div>
      </div>
    </div>

    {/* Screen Content */}
    <div className="bg-slate-50 h-full w-full overflow-y-auto pt-[44px] pb-[80px] scrollbar-hide font-sans antialiased">
      {children}
    </div>
  </div>
);

// --- MAIN APP ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'staff' | 'compare' | 'register'>('map');
  const [stations, setStations] = useState<Station[]>([]);
  const [history, setHistory] = useState<LogEntry[]>([]);
  // Fix: Removed 'loading' variable but kept 'setLoading' setter
  const [, setLoading] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const refreshData = async () => {
    try {
      const sRes = await axios.get(`${API_URL}/api/stations`);
      const hRes = await axios.get(`${API_URL}/api/history`);
      setStations(sRes.data);
      setHistory(hRes.data);
    } catch (err) {
      console.error("Backend offline");
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
        refreshData();
        setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 to-slate-300 p-4 lg:p-8 flex flex-col lg:flex-row gap-12 items-center lg:items-start justify-center font-sans">
      
      {/* LEFT: PHONE SIMULATOR */}
      <div className="flex flex-col items-center z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h2 className="text-sm font-bold tracking-widest text-slate-500 uppercase mb-6 lg:block hidden">Interactive Prototype</h2>
        
        <PhoneFrame statusBarTime={time}>
          {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
          
          {activeTab === 'map' && <MapScreen stations={stations} />}
          {activeTab === 'staff' && <StaffScreen stations={stations} onUpdate={refreshData} setLoading={setLoading} showToast={showToast} />}
          {activeTab === 'compare' && <CompareScreen stations={stations} />}
          {activeTab === 'register' && <RegisterScreen onUpdate={refreshData} setLoading={setLoading} showToast={showToast} />}
          
          {/* Bottom Nav */}
          <div className="absolute bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 h-[80px] flex justify-between px-6 pb-4 items-center z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            <NavBtn icon={MapIcon} label="Map" active={activeTab==='map'} onClick={() => setActiveTab('map')} />
            <NavBtn icon={Settings} label="Staff" active={activeTab==='staff'} onClick={() => setActiveTab('staff')} />
            <NavBtn icon={TrendingUp} label="Prices" active={activeTab==='compare'} onClick={() => setActiveTab('compare')} />
            <NavBtn icon={PlusCircle} label="Add" active={activeTab==='register'} onClick={() => setActiveTab('register')} />
          </div>
        </PhoneFrame>
      </div>

      {/* RIGHT: BACKEND VIEW (Hidden on mobile) */}
      <div className="hidden lg:flex w-full lg:w-[600px] h-[720px] bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 flex-col overflow-hidden animate-in fade-in slide-in-from-right-8 duration-700">
        <div className="bg-slate-950 text-slate-200 p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Database size={20} /></div>
            <div>
                <h2 className="font-semibold text-sm">FuelNetwork Cloud™</h2>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Connection
                </div>
            </div>
          </div>
          <div className="text-xs font-mono text-slate-600">v1.0.4-POC</div>
        </div>
        
        {/* Terminal Header */}
        <div className="bg-slate-900 p-3 flex gap-2 border-b border-slate-800">
            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
        </div>

        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-900 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="p-3 font-normal w-24">TIMESTAMP</th>
                <th className="p-3 font-normal w-32">STATION</th>
                <th className="p-3 font-normal w-24">ACTOR</th>
                <th className="p-3 font-normal">PAYLOAD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {history.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="p-3 text-slate-400 whitespace-nowrap group-hover:text-indigo-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-3 text-slate-300 font-medium truncate max-w-[120px]" title={log.stationName}>
                    {log.stationName}
                  </td>
                  <td className="p-3 text-slate-500">
                    {log.updatedBy}
                  </td>
                  <td className="p-3">
                    {log.type === 'REGISTRATION' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <PlusCircle size={10} className="mr-1"/> Registered
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <span className="text-slate-400">Reg:
                          <span className="text-indigo-400">
                            ${log.details && log.details.regular ? log.details.regular : '--'}
                          </span>
                        </span>
                        <span className="text-slate-400">Dsl:
                          <span className="text-orange-400">
                            ${log.details && log.details.diesel ? log.details.diesel : '--'}
                          </span>
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-600 italic">Waiting for incoming data stream...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- SCREEN 1: MAP VIEW ---
const MapScreen = ({ stations }: { stations: Station[] }) => {
  const center: LatLngExpression = [32.7767, -96.7970]; 
  
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white shadow-sm z-10 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">Explore</h1>
        <div className="bg-slate-100 p-2 rounded-full">
            <Menu size={20} className="text-slate-600" />
        </div>
      </div>

      <div className="h-2/3 w-full relative z-0">
        <MapContainer center={center} zoom={12} zoomControl={false} className="h-full w-full outline-none">
          <TileLayer 
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {stations.map(s => (
            <Marker key={s.id} position={[s.lat, s.lng] as LatLngExpression}>
              <Popup className="custom-popup">
                <div className="p-1">
                    <strong className="block text-sm mb-1">{s.name}</strong>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">${s.prices.regular}</span>
                    </div>
                </div>
              </Popup>
            </Marker>
          ))}
          <MapReCenter stations={stations} />
        </MapContainer>
      </div>

      {/* Bottom Sheet */}
      <div className="h-1/3 bg-white rounded-t-3xl -mt-6 relative z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] p-5 overflow-y-auto">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4"></div>
        <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider mb-3">Nearby Stations</h3>
        
        {stations.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">No stations available</div>
        ) : (
            stations.map(s => (
            <div key={s.id} className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-transform">
                <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Navigation size={18} fill="currentColor" className="text-blue-600/20" />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-slate-800">{s.name}</div>
                        <div className="text-[10px] text-slate-500 font-medium">0.8 mi • Open 24h</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold text-slate-800">${s.prices.regular}</div>
                    <div className="text-[10px] text-slate-400 font-medium">Regular</div>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

// Helper to center map
function MapReCenter({ stations }: { stations: Station[] }) {
    const map = useMap();
    useEffect(() => {
        if (stations.length > 0) {
            map.flyTo([stations[stations.length -1].lat, stations[stations.length -1].lng], 12, { duration: 1.5 });
        }
    }, [stations.length, map]);
    return null;
}

// --- SCREEN 2: STAFF VIEW ---
const StaffScreen = ({ stations, onUpdate, setLoading, showToast }: any) => {
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [formData, setFormData] = useState<Prices>({ regular: '', midgrade: '', premium: '', diesel: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if(!selectedStation) return showToast("Please select a store", 'error');
    
    setIsSubmitting(true);
    setLoading(true);
    
    try {
        // Fix: Corrected template literal syntax
        await axios.post(`${API_URL}/api/update-price`, {
            stationId: selectedStation,
            user: "Staff_User",
            prices: formData
        });
        showToast("Prices updated successfully!", 'success');
        onUpdate();
        setFormData({ regular: '', midgrade: '', premium: '', diesel: '' });
    } catch (e) {
        showToast("Failed to update prices", 'error');
    } finally {
        setIsSubmitting(false);
        setLoading(false);
    }
  };

  return (
    <div className="p-6">
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Set Fuel Prices</h2>
            <p className="text-sm text-slate-500">Update the daily board prices.</p>
        </div>
      
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Store</label>
      <div className="relative mb-6">
        <select 
            className="w-full p-4 border border-slate-200 rounded-xl bg-white appearance-none text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
        >
            <option value="">-- Choose Location --</option>
            {stations.map((s: Station) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
      </div>

      <div className="space-y-4">
        <PriceInput label="Regular (87)" value={formData.regular} onChange={(v: any) => setFormData({...formData, regular: v})} placeholder="2.57" color="blue" />
        <PriceInput label="Midgrade (89)" value={formData.midgrade} onChange={(v: any) => setFormData({...formData, midgrade: v})} placeholder="3.19" color="slate" />
        <PriceInput label="Premium (93)" value={formData.premium} onChange={(v: any) => setFormData({...formData, premium: v})} placeholder="3.79" color="slate" />
        <PriceInput label="Diesel" value={formData.diesel} onChange={(v: any) => setFormData({...formData, diesel: v})} placeholder="3.69" color="orange" />
      </div>

      <button 
        onClick={handleSubmit} 
        disabled={isSubmitting}
        className="w-full bg-blue-600 active:bg-blue-700 disabled:bg-blue-300 text-white py-4 rounded-xl font-bold mt-8 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all"
      >
        {isSubmitting ? <span className="animate-spin">↻</span> : <Save size={18} />} 
        {isSubmitting ? 'Updating...' : 'Submit Prices'}
      </button>
    </div>
  );
};

// --- SCREEN 3: REGISTER SCREEN ---
const RegisterScreen = ({ onUpdate, setLoading, showToast }: any) => {
  const [form, setForm] = useState({ name: '', lat: '32.7767', lng: '-96.7970' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if(!form.name) return showToast("Station Name required", 'error');
    
    setIsSubmitting(true);
    setLoading(true);

    try {
        // Fix: Corrected template literal syntax
        await axios.post(`${API_URL}/api/stations`, form);
        showToast("New station registered!", 'success');
        onUpdate();
        setForm({ name: '', lat: '32.7767', lng: '-96.7970' });
    } catch (e) {
        showToast("Registration failed", 'error');
    } finally {
        setIsSubmitting(false);
        setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">New Station</h2>
        <p className="text-sm text-slate-500">Register a pump to the network.</p>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-6 flex gap-3 items-start">
        <PlusCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
        <p className="text-xs text-emerald-800 leading-relaxed">
            Adding a station will instantly make it visible on the Map and Staff dashboards.
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Station Name</label>
            <input className="w-full p-3 border border-slate-200 rounded-lg text-sm font-medium focus:border-emerald-500 outline-none" 
                value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. 7-Eleven South" />
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
            <input className="w-full p-3 border border-slate-200 rounded-lg text-sm font-medium focus:border-emerald-500 outline-none" 
                value={form.lat} onChange={e => setForm({...form, lat: e.target.value})} />
            </div>
            <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
            <input className="w-full p-3 border border-slate-200 rounded-lg text-sm font-medium focus:border-emerald-500 outline-none" 
                value={form.lng} onChange={e => setForm({...form, lng: e.target.value})} />
            </div>
        </div>
      </div>
      
      <button 
        onClick={handleRegister} 
        disabled={isSubmitting}
        className="w-full bg-emerald-600 active:bg-emerald-700 disabled:bg-emerald-300 text-white py-4 rounded-xl font-bold mt-8 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all"
      >
        {isSubmitting ? <span className="animate-spin">↻</span> : <CheckCircle2 size={18} />} 
        {isSubmitting ? 'Registering...' : 'Register Station'}
      </button>
    </div>
  );
};

// --- SCREEN 4: COMPARE VIEW ---
const CompareScreen = ({ stations }: { stations: Station[] }) => {
  const sorted = [...stations].sort((a,b) => Number(a.prices.regular) - Number(b.prices.regular));
  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Best Prices</h2>
        <span className="text-xs font-medium text-slate-400">Near You</span>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        <FilterChip label="Cheapest" active={true} />
        <FilterChip label="Nearest" active={false} />
        <FilterChip label="Diesel" active={false} />
      </div>

      {sorted.map((s, i) => (
        <div key={s.id} className="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          {i === 0 && (
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm">
                BEST DEAL
            </div>
          )}
          <div className="flex justify-between items-start mb-3">
            <div>
                <h3 className="font-bold text-slate-800 text-lg">{s.name}</h3>
                <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                    <Clock size={12} />
                    <span>Updated 5m ago</span>
                </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            <PriceBadge type="Regular" price={s.prices.regular} highlight />
            <PriceBadge type="Mid" price={s.prices.midgrade} />
            <PriceBadge type="Prm" price={s.prices.premium} />
            <PriceBadge type="Dsl" price={s.prices.diesel} />
          </div>
        </div>
      ))}
    </div>
  );
};

// --- UI HELPERS ---
const PriceInput = ({ label, value, onChange, placeholder, color = 'slate' }: any) => {
    const ringColor = color === 'blue' ? 'focus-within:ring-blue-500' : color === 'orange' ? 'focus-within:ring-orange-500' : 'focus-within:ring-slate-400';
    const textColor = color === 'blue' ? 'text-blue-600' : color === 'orange' ? 'text-orange-600' : 'text-slate-700';

    return (
        <div className={`bg-slate-50 border border-slate-200 rounded-xl p-3 px-4 flex justify-between items-center transition-all ${ringColor} focus-within:ring-1 focus-within:bg-white`}>
            <label className="text-sm font-semibold text-slate-500">{label}</label>
            <div className="flex items-center gap-1">
                <span className="text-slate-400 text-lg">$</span>
                <input 
                    type="number" 
                    step="0.01" 
                    className={`w-20 bg-transparent text-right font-mono text-xl font-bold outline-none ${textColor}`} 
                    placeholder={placeholder} 
                    value={value} 
                    onChange={(e) => onChange(e.target.value)} 
                />
            </div>
        </div>
    );
};

const NavBtn = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`group flex flex-col items-center gap-1.5 transition-all ${active ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
    <div className={`relative p-1 rounded-xl transition-all ${active ? 'bg-blue-50' : ''}`}>
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
        {active && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></span>}
    </div>
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const FilterChip = ({ label, active }: { label: string, active: boolean }) => (
    <button className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
        {label}
    </button>
);

const PriceBadge = ({ type, price, highlight }: any) => (
    <div className={`flex flex-col items-center justify-center p-2 rounded-lg ${highlight ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
        <span className={`text-[10px] uppercase font-bold mb-0.5 ${highlight ? 'text-blue-400' : 'text-slate-400'}`}>{type}</span>
        <span className={`font-mono font-bold ${highlight ? 'text-blue-700 text-base' : 'text-slate-600 text-sm'}`}>
            {Number(price) > 0 ? price : '-.--'}
        </span>
    </div>
);

// --- ICONS ---
const SignalIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M2 22h20V2z" /></svg>
);
const WifiIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M12 3C7.79 3 3.7 4.41.38 7L12 21.5 23.62 7C20.3 4.41 16.21 3 12 3z" /></svg>
);
const BatteryIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M17 4h-3V2h-4v2H7v18h10V4z" /></svg>
);
