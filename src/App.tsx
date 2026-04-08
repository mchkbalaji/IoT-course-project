import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Router, 
  BarChart3, 
  Settings, 
  Bell, 
  Info,
  Activity, 
  ShieldAlert, 
  Wifi, 
  WifiOff,
  Search,
  Filter,
  ArrowUpRight,
  MoreVertical,
  ChevronRight,
  AlertTriangle,
  Mic2,
  LogIn,
  LogOut,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, ContactShadows } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { Alert, Device, DashboardStats, Severity } from './types';
import { db, auth, signIn, signOut, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, limit, addDoc, setDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';

// --- 3D Model Component ---

const SensorModel = () => {
  return (
    <group>
      {/* Base of the sensor */}
      <mesh position={[0, -0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.8, 1, 0.2, 32]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.8} />
      </mesh>
      
      {/* Main body */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 1.2, 32]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.5} />
      </mesh>
      
      {/* Top sensor head */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#333333" roughness={0.1} metalness={0.9} wireframe />
      </mesh>

      {/* Status LED */}
      <mesh position={[0, 0.5, 0.6]} castShadow>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
      </mesh>
    </group>
  );
};

const ModelViewer = () => {
  const [showCredits, setShowCredits] = useState(false);

  return (
    <div className="h-full w-full bg-[#050505] rounded-xl overflow-hidden relative border border-outline-variant/10 shadow-inner">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center text-on-surface-variant font-bold text-xs animate-pulse">
          Loading 3D Model...
        </div>
      }>
        <Canvas shadows camera={{ position: [0, 2, 5], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} shadow-mapSize={[512, 512]} castShadow />
          <Stage environment="city" intensity={0.6}>
            <SensorModel />
          </Stage>
          <OrbitControls 
            autoRotate 
            autoRotateSpeed={4} 
            enablePan={false} 
            enableZoom={true} 
            minPolarAngle={Math.PI / 4} 
            maxPolarAngle={Math.PI / 2} 
          />
          <ContactShadows position={[0, -1.4, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
        </Canvas>
      </Suspense>
      
      <div className="absolute top-3 right-3 flex gap-2">
        <button 
          onClick={() => setShowCredits(!showCredits)}
          className="bg-black/60 hover:bg-black/80 backdrop-blur-md p-1.5 rounded-full text-on-surface-variant transition-colors border border-white/5"
          title="Model Credits"
        >
          <Info className="w-3 h-3" />
        </button>
      </div>

      <AnimatePresence>
        {showCredits && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-x-3 bottom-12 bg-black/90 backdrop-blur-xl p-4 rounded-xl border border-white/10 text-[10px] text-on-surface-variant leading-relaxed z-10"
          >
            <p className="font-bold mb-1 text-on-surface">3D Model Attribution</p>
            <p>
              "Raspberry Pi" by <a href="https://sketchfab.com/Aleksander2019" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Aleksander Buzlaev</a> is licensed under <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">CC-BY-4.0</a>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[9px] text-on-surface-variant/70 font-bold uppercase tracking-widest border border-white/5 pointer-events-none">
        Interactive 3D View
      </div>
    </div>
  );
};

// --- Components ---

const StatusBadge = ({ status }: { status: 'active' | 'offline' }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
    status === 'active' 
      ? 'bg-secondary/10 border-secondary/20 text-secondary' 
      : 'bg-on-surface-variant/10 border-on-surface-variant/20 text-on-surface-variant'
  }`}>
    <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-secondary animate-pulse' : 'bg-on-surface-variant'}`} />
    <span className="text-[10px] font-bold uppercase tracking-widest">{status}</span>
  </div>
);

const SeverityBadge = ({ severity }: { severity: Severity }) => {
  const styles = {
    high: 'bg-error/10 text-error border-error/20',
    medium: 'bg-tertiary/10 text-tertiary border-tertiary/20',
    low: 'bg-secondary/10 text-secondary border-secondary/20',
  };
  
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border ${styles[severity]}`}>
      {severity === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-error pulse-error" />}
      {severity}
    </span>
  );
};

const SummaryCard = ({ title, value, subtitle, icon: Icon, colorClass, trend }: any) => (
  <div className="bg-surface-container-low p-8 rounded-2xl relative overflow-hidden group border border-outline-variant/5 shadow-lg">
    <div className="flex justify-between items-start mb-6">
      <div className={`p-3 rounded-xl ${colorClass.bg}`}>
        <Icon className={`w-6 h-6 ${colorClass.text}`} />
      </div>
      {trend && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colorClass.bg} ${colorClass.border}`}>
          <ArrowUpRight className={`w-3 h-3 ${colorClass.text}`} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${colorClass.text}`}>{trend}</span>
        </div>
      )}
    </div>
    <h3 className="text-on-surface-variant text-xs font-bold uppercase tracking-[0.2em] mb-2">{title}</h3>
    <div className={`text-5xl font-extrabold font-headline tracking-tight ${colorClass.mainText || 'text-primary'}`}>{value}</div>
    <div className="absolute bottom-0 right-0 opacity-5 translate-y-8 group-hover:translate-y-4 transition-transform duration-700 ease-out">
      <Icon className="w-40 h-40" />
    </div>
  </div>
);

// --- Views ---

const DashboardView = ({ alerts }: { alerts: Alert[] }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div>
          <h1 className="text-5xl font-extrabold font-headline tracking-tighter text-primary mb-3">Live Activity Stream</h1>
          <p className="text-on-surface-variant text-base max-w-2xl leading-relaxed">
            High-fidelity acoustic monitoring and threat categorization. Analyzing sensor data across all active zones for immediate response.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 glass-panel p-2.5 rounded-2xl border border-outline-variant/20 shadow-xl">
          <div className="flex flex-col px-4">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 mb-1 tracking-widest">Severity</span>
            <select className="bg-transparent border-none text-sm font-bold text-primary p-0 focus:ring-0 cursor-pointer min-w-[100px]">
              <option>All Levels</option>
              <option>High Priority</option>
              <option>Medium Priority</option>
              <option>Low Priority</option>
            </select>
          </div>
          <div className="h-10 w-px bg-outline-variant/20" />
          <div className="flex flex-col px-4">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 mb-1 tracking-widest">Device Node</span>
            <select className="bg-transparent border-none text-sm font-bold text-primary p-0 focus:ring-0 cursor-pointer min-w-[100px]">
              <option>All Nodes</option>
              <option>NODE-N-01</option>
              <option>NODE-S-02</option>
              <option>NODE-E-03</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <SummaryCard 
          title="Network Nodes" 
          value="04" 
          icon={Router} 
          colorClass={{ bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/20' }}
          trend="4/4 Active"
        />
        <SummaryCard 
          title="Alerts (Live)" 
          value={alerts.length} 
          icon={Bell} 
          colorClass={{ bg: 'bg-tertiary/10', text: 'text-tertiary', border: 'border-tertiary/20' }}
          trend="Real-time Sync"
        />
        <SummaryCard 
          title="Critical Events" 
          value={alerts.filter(a => a.severity === 'high').length} 
          icon={ShieldAlert} 
          colorClass={{ bg: 'bg-error/10', text: 'text-error', border: 'border-error/30', mainText: 'text-error' }}
          trend="High Priority"
        />
      </div>

      <section className="bg-surface-container-low rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/10">
        <div className="px-8 py-5 bg-surface-container-high flex justify-between items-center border-b border-outline-variant/10">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-error" />
              <div className="w-3.5 h-3.5 rounded-full bg-tertiary/50" />
              <div className="w-3.5 h-3.5 rounded-full bg-secondary/50" />
            </div>
            <span className="text-[11px] font-mono font-bold text-on-surface-variant/60 tracking-widest uppercase">Daemon :: v2.0.4_ALERTS_ENG</span>
          </div>
          <div className="flex gap-6 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-[0.15em]">
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-error shadow-[0_0_10px_rgba(255,113,108,0.5)]" /> Critical</span>
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-tertiary" /> Warning</span>
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-secondary" /> Routine</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container/50 border-b border-outline-variant/10">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Sensor Location</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Classification</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">AI Confidence</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Timestamp</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Severity</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              <AnimatePresence mode="popLayout">
                {alerts.length > 0 ? (
                  alerts.map((alert) => (
                    <motion.tr 
                      key={alert.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="hover:bg-surface-bright/50 transition-colors group cursor-default"
                    >
                      <td className="px-8 py-6 font-mono text-sm text-primary">{alert.room}</td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <Mic2 className={`w-5 h-5 ${alert.severity === 'high' ? 'text-error' : alert.severity === 'medium' ? 'text-tertiary' : 'text-secondary'}`} />
                          <span className="text-sm font-semibold text-primary">{alert.alert_type}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="w-32 bg-surface-container-highest h-2 rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full transition-all duration-1000 ${alert.severity === 'high' ? 'bg-error shadow-[0_0_8px_rgba(255,113,108,0.4)]' : alert.severity === 'medium' ? 'bg-tertiary' : 'bg-secondary'}`} 
                            style={{ width: `${alert.confidence}%` }} 
                          />
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant/80">{alert.confidence.toFixed(2)}% Probability</span>
                      </td>
                      <td className="px-8 py-6 font-mono text-xs text-on-surface-variant">
                        {alert.timestamp && (
                          typeof alert.timestamp === 'string' 
                            ? new Date(alert.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : (alert.timestamp as any).toDate?.().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '...'
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <SeverityBadge severity={alert.severity} />
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button className="w-10 h-10 rounded-lg hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-primary transition-all">
                          <BarChart3 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-40">
                        <Activity className="w-12 h-12 text-on-surface-variant" />
                        <p className="text-sm font-bold uppercase tracking-widest">No alerts detected in the current session</p>
                      </div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        <div className="px-8 py-4 bg-black/40 font-mono text-[10px] text-on-surface-variant/50 flex justify-between tracking-widest uppercase">
          <div className="flex gap-8">
            <span className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" /> Infrastructure: Optimal</span>
            <span>Packet_Loss: 0.0001%</span>
          </div>
          <span>Last Scan: 0.04s Ago</span>
        </div>
      </section>
    </motion.div>
  );
};

const DeviceMonitoringView = ({ devices }: { devices: Device[] }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h1 className="text-4xl font-extrabold text-primary font-headline tracking-tight mb-3">Digital Twins</h1>
          <p className="text-on-surface-variant max-w-xl text-lg">Monitoring acoustic sensors across the facility. Real-time telemetry and advanced hardware visualization.</p>
        </div>
        <div className="flex items-center gap-4 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input 
              className="bg-transparent border-none text-sm rounded-lg pl-10 pr-4 py-2 w-48 focus:ring-0 text-primary transition-all placeholder:text-on-surface-variant/50" 
              placeholder="Quick find..." 
              type="text"
            />
          </div>
          <div className="h-8 w-px bg-outline-variant/20" />
          <div className="flex gap-1">
            <button className="px-5 py-1.5 text-xs font-bold rounded-lg bg-surface-container-highest text-primary shadow-sm">All</button>
            <button className="px-5 py-1.5 text-xs font-bold rounded-lg text-on-surface-variant hover:text-primary transition-colors">Alerts</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {devices.length > 0 ? (
          devices.map((device) => (
            <div 
              key={device.device_id}
              className={`bg-surface-container-high rounded-2xl overflow-hidden relative group hover:bg-surface-bright transition-all duration-300 flex flex-col min-h-[500px] border border-outline-variant/10 ${
                device.status === 'offline' ? 'opacity-75 grayscale-[0.5]' : device.recent_alerts.some(a => a.severity === 'high') ? 'ring-2 ring-error/30' : ''
              }`}
            >
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <span className="text-[10px] text-on-surface-variant font-extrabold uppercase tracking-widest mb-1 block">
                      {device.device_id.includes('N') ? 'Critical Infrastructure' : 'Public Zone'}
                    </span>
                    <h3 className="text-primary font-black text-2xl font-headline tracking-tight">{device.device_id}</h3>
                    <p className="text-sm text-on-surface-variant font-medium">{device.room}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <StatusBadge status={device.status} />
                    <span className="text-[11px] text-on-surface-variant font-bold bg-surface-container/50 px-2 py-1 rounded">
                      Seen: {device.last_seen && (
                        typeof device.last_seen === 'string'
                          ? new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : (device.last_seen as any).toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '...'
                      )}
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full flex items-center justify-center mb-10">
                  <ModelViewer />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[11px] uppercase tracking-widest font-black text-on-surface-variant/70 border-b border-outline-variant/10 pb-2">Recent Activities</p>
                    <ul className="space-y-3">
                      {device.recent_alerts.length > 0 ? (
                        device.recent_alerts.slice(0, 5).map((alert) => (
                          <li key={alert.id} className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${alert.severity === 'high' ? 'text-error' : 'text-on-surface'}`}>{alert.alert_type}</span>
                            <span className="text-sm font-manrope font-black text-primary">{alert.confidence.toFixed(0)}%</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-on-surface-variant italic">No recent alerts</li>
                      )}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[11px] uppercase tracking-widest font-black text-on-surface-variant/70 border-b border-outline-variant/10 pb-2">Environment</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="bg-surface-container-highest px-2 py-1 rounded text-[10px] font-bold text-on-surface-variant">DB Level: 42dB</span>
                      <span className="bg-surface-container-highest px-2 py-1 rounded text-[10px] font-bold text-on-surface-variant">Temp: 24°C</span>
                    </div>
                    <button className="w-full py-3 px-4 bg-surface-container-highest text-on-surface rounded-xl font-bold text-xs hover:bg-surface-bright transition-all flex items-center justify-center gap-2 border border-outline-variant/10">
                      <Activity className="w-4 h-4" />
                      View Detailed Log
                    </button>
                  </div>
                </div>
              </div>
              {device.recent_alerts.some(a => a.severity === 'high') && (
                <div className="bg-error/10 p-5 flex justify-center border-t border-error/20">
                  <button className="text-xs font-black text-error uppercase tracking-[0.2em] hover:tracking-[0.25em] transition-all flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Acknowledge & Investigate
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full bg-surface-container-low border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center p-20">
            <WifiOff className="w-16 h-16 text-on-surface-variant/30 mb-6" />
            <h3 className="text-2xl font-bold text-primary mb-2">No Devices Connected</h3>
            <p className="text-on-surface-variant text-center max-w-md text-sm">
              The monitoring network is currently silent. Once your edge devices are online, they will appear here automatically.
            </p>
          </div>
        )}

        <div className="bg-surface-container-low border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center p-12 hover:border-primary/40 hover:bg-surface-container transition-all group cursor-pointer min-h-[500px]">
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
              <Settings className="w-10 h-10 text-primary" />
            </motion.div>
          </div>
          <h3 className="text-xl font-bold text-primary mb-2">Deploy New Sensor</h3>
          <p className="text-on-surface-variant text-center max-w-xs text-sm">Add a new acoustic edge device to your monitoring network.</p>
          <div className="mt-8 px-8 py-3 bg-primary text-background rounded-xl font-bold text-sm">Get Started</div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Login Screen ---

const LoginScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-surface-container-low p-12 rounded-3xl border border-outline-variant/10 shadow-2xl max-w-md w-full text-center"
    >
      <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(249,249,249,0.2)]">
        <ShieldAlert className="w-10 h-10 text-background" />
      </div>
      <h1 className="text-3xl font-black font-headline text-primary mb-4 tracking-tighter">SonicSentry AI</h1>
      <p className="text-on-surface-variant mb-10 leading-relaxed">Secure access to real-time acoustic threat intelligence and device monitoring.</p>
      <button 
        onClick={signIn}
        className="w-full bg-primary text-background py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
      >
        <LogIn className="w-5 h-5" />
        Sign in with Google
      </button>
      <div className="mt-8 text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest">
        Secured Core :: Enterprise Edition
      </div>
    </motion.div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'devices'>('alerts');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      setDevices([]);
      return;
    }

    // 1. Real-time Alerts Listener
    const alertsQuery = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const newAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      setAlerts(newAlerts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'alerts');
    });

    // 2. Real-time Devices Listener
    const unsubscribeDevices = onSnapshot(collection(db, 'devices'), (snapshot) => {
      const newDevices = snapshot.docs.map(doc => ({ 
        ...doc.data(),
        id: doc.id, 
      } as unknown as Device));
      
      setDevices(newDevices);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'devices');
    });

    return () => {
      unsubscribeAlerts();
      unsubscribeDevices();
    };
  }, [user]); // Only re-run if user changes

  // 3. Computed Devices with Alerts (to avoid re-subscribing when alerts change)
  const devicesWithAlerts = useMemo(() => {
    return devices.map(device => ({
      ...device,
      recent_alerts: alerts.filter(a => a.device_id === device.device_id).slice(0, 5)
    }));
  }, [devices, alerts]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary selection:text-background">
      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 bg-surface-container-low/80 backdrop-blur-md flex justify-between items-center px-8 h-16 border-b border-outline-variant/10">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-background" />
            </div>
            <span className="text-xl font-extrabold text-primary tracking-tighter font-headline">SonicSentry AI</span>
          </div>
          <nav className="hidden md:flex items-center space-x-2 font-headline font-bold text-sm tracking-tight">
            <button 
              onClick={() => setActiveTab('alerts')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === 'alerts' ? 'text-primary bg-surface-container-highest border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-highest'}`}
            >
              Real-Time Alerts
            </button>
            <button 
              onClick={() => setActiveTab('devices')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === 'devices' ? 'text-primary bg-surface-container-highest border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-highest'}`}
            >
              Device Monitoring
            </button>
            <button className="text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all duration-200 px-4 py-2 rounded-lg">
              Analytics
            </button>
          </nav>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2 bg-surface-container-high px-4 py-1.5 rounded-full border border-outline-variant/20">
            <Wifi className="w-4 h-4 text-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">System Connected</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-outline-variant/20">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-bold text-primary uppercase leading-none">{user.displayName}</div>
                <div className="text-[9px] text-on-surface-variant uppercase tracking-tighter">Operator</div>
              </div>
              <button 
                onClick={signOut}
                className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30 hover:border-primary transition-all relative group"
              >
                <img 
                  alt="User" 
                  src={user.photoURL || "https://picsum.photos/seed/user/100/100"} 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <LogOut className="w-3 h-3 text-primary" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto pt-24 px-8 pb-12 min-h-screen">
        <AnimatePresence mode="wait">
          {activeTab === 'alerts' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DashboardView alerts={alerts} />
            </motion.div>
          ) : (
            <motion.div 
              key="monitoring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DeviceMonitoringView devices={devicesWithAlerts} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-24 pt-8 border-t border-outline-variant/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start">
              <span className="text-sm font-bold text-primary mb-1">SonicSentry Enterprise</span>
              <span className="text-xs text-on-surface-variant">IoT Sound Intelligence & Security Platform</span>
            </div>
            <div className="flex gap-10">
              <a href="#" className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest">Documentation</a>
              <a href="#" className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest">API Reference</a>
              <a href="#" className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest">Support</a>
            </div>
            <div className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest">
              © 2024 SonicSentry AI. Secured Core.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
