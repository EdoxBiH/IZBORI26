import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Settings, 
  Play, 
  Square, 
  RotateCcw, 
  Copy, 
  Check, 
  MapPin, 
  Users, 
  Percent, 
  Lock, 
  Unlock, 
  RefreshCw, 
  AlertCircle, 
  ChevronRight, 
  Code,
  LayoutDashboard,
  Vote,
  FileText
} from 'lucide-react';

// Interfaces mapping to backend types
interface Candidate {
  id: string;
  name: string;
  party: string;
  partyShort: string;
  votes: number;
  percent: number;
  color: string;
  textClass: string;
}

interface PartyResult {
  name: string;
  shortName: string;
  votes: number;
  percent: number;
  estimatedSeats: number;
  color: string;
}

interface Canton {
  id: number;
  name: string;
  processedPercent: number;
  turnoutPercent: number;
  totalVoters: number;
  parties: {
    name: string;
    shortName: string;
    votes: number;
    percent: number;
    color: string;
  }[];
}

interface ElectionData {
  totalVoters: number;
  overallTurnoutPercent: number;
  processedPollingStationsPercent: number;
  lastUpdated: string;
  statusMessage: string;
  simulationActive: boolean;
  simulationSpeed: number;
  predsjednistvo: {
    bosnjacki: Candidate[];
    hrvatski: Candidate[];
    srpski: Candidate[];
  };
  parlamentBiH: PartyResult[];
  parlamentFBiH: PartyResult[];
  kantoni: Canton[];
}

export default function App() {
  // Query Parameters
  const [isEmbed, setIsEmbed] = useState(false);
  const [embedTheme, setEmbedTheme] = useState<'light' | 'dark'>('light');

  // Main Election State
  const [data, setData] = useState<ElectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'predsjednistvo' | 'parlament_bih' | 'parlament_fbih' | 'kantoni' | 'embed_generator'>('predsjednistvo');

  // Interactive UI State
  const [selectedCantonId, setSelectedCantonId] = useState<number>(9); // Default: Sarajevo
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Admin Panel State
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);

  // Admin Edit values
  const [selectedEditCategory, setSelectedEditCategory] = useState<'settings' | 'predsjednistvo' | 'parlament_bih' | 'parlament_fbih' | 'kantoni'>('settings');
  const [tempStatusMessage, setTempStatusMessage] = useState('');
  const [tempTurnout, setTempTurnout] = useState(0);
  const [tempProcessed, setTempProcessed] = useState(0);
  const [tempTotalVoters, setTempTotalVoters] = useState(0);
  
  // Custom Embed Generator state
  const [genTheme, setGenTheme] = useState<'light' | 'dark'>('light');
  const [genDefaultTab, setGenDefaultTab] = useState<string>('predsjednistvo');
  const [copiedText, setCopiedText] = useState(false);

  // Parse Query Parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed') === 'true') {
      setIsEmbed(true);
    }
    if (params.get('theme') === 'dark') {
      setEmbedTheme('dark');
    }
    const tabParam = params.get('tab');
    if (tabParam && ['predsjednistvo', 'parlament_bih', 'parlament_fbih', 'kantoni'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
    const cantonParam = params.get('canton');
    if (cantonParam && !isNaN(Number(cantonParam))) {
      setSelectedCantonId(Number(cantonParam));
    }
  }, []);

  // Fetch election data
  const fetchElectionData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/election-data');
      if (!res.ok) throw new Error('Problem sa preuzimanjem podataka sa servera.');
      const json: ElectionData = await res.json();
      setData(json);
      
      // Sync admin temp inputs
      if (!silent || !tempStatusMessage) {
        setTempStatusMessage(json.statusMessage);
        setTempTurnout(json.overallTurnoutPercent);
        setTempProcessed(json.processedPollingStationsPercent);
        setTempTotalVoters(json.totalVoters);
      }
      
      setError(null);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error(err);
      setError('Nemoguće učitati izborne rezultate. Provjerite vezu.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial Fetch & Auto Refresh
  useEffect(() => {
    fetchElectionData();

    let intervalId: any = null;
    if (isAutoRefreshing) {
      intervalId = setInterval(() => {
        fetchElectionData(true);
      }, 5000); // Poll every 5s for live results
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoRefreshing]);

  // Admin login handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setAdminToken(resData.token);
        setLoginError(null);
      } else {
        setLoginError(resData.message || 'Pogrešna lozinka!');
      }
    } catch (err) {
      setLoginError('Došlo je do greške prilikom prijave.');
    }
  };

  // Admin logout
  const handleAdminLogout = () => {
    setAdminToken(null);
    setAdminPassword('');
    setAdminSuccessMsg(null);
  };

  // Toggle Live Simulation on server
  const handleToggleSimulation = async (active: boolean, speed = 2) => {
    try {
      const res = await fetch('/api/admin/toggle-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, active, speed })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        showSuccessMessage(`Simulacija je ${active ? 'UKLJUČENA' : 'ISKLJUČENA'}.`);
        fetchElectionData(true);
      } else {
        alert(resData.message || 'Greška pri kontroli simulacije.');
      }
    } catch (err) {
      alert('Serverska greška.');
    }
  };

  // Reset results on server
  const handleResetData = async (mode: 'seed' | 'zero') => {
    if (!window.confirm(`Da li ste sigurni da želite resetovati rezultate na ${mode === 'seed' ? 'početne realne rezultate' : 'nula (0)'}?`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, mode })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        showSuccessMessage('Podaci su uspješno resetovani.');
        fetchElectionData();
      } else {
        alert(resData.message || 'Greška pri resetovanju podataka.');
      }
    } catch (err) {
      alert('Serverska greška.');
    }
  };

  // Save general settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          statusMessage: tempStatusMessage,
          totalVoters: tempTotalVoters,
          overallTurnoutPercent: tempTurnout,
          processedPollingStationsPercent: tempProcessed
        })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        showSuccessMessage('Postavke su sačuvane!');
        fetchElectionData(true);
      } else {
        alert(resData.message || 'Greška.');
      }
    } catch (err) {
      alert('Došlo je do greške.');
    }
  };

  // Manual vote updating
  const handleUpdateVotes = async (
    type: 'predsjednistvo' | 'parlamentBiH' | 'parlamentFBiH' | 'canton',
    votes: number,
    candidateId?: string,
    partyShort?: string,
    cantonId?: number
  ) => {
    try {
      const res = await fetch('/api/admin/update-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          type,
          candidateId,
          partyShort,
          cantonId,
          votes
        })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        showSuccessMessage('Glasovi uspješno ažurirani na serveru.');
        fetchElectionData(true);
      } else {
        alert(resData.message || 'Greška pri snimanju.');
      }
    } catch (err) {
      alert('Greška pri konekciji sa serverom.');
    }
  };

  // Update Canton Metadata (processed/turnout)
  const handleUpdateCantonMeta = async (cantonId: number, processed: number, turnout: number) => {
    try {
      const res = await fetch('/api/admin/update-canton-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          cantonId,
          processedPercent: processed,
          turnoutPercent: turnout
        })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        showSuccessMessage('Kantonalni podaci ažurirani.');
        fetchElectionData(true);
      } else {
        alert(resData.message || 'Greška.');
      }
    } catch (err) {
      alert('Greška na serveru.');
    }
  };

  // Quick message display helper
  const showSuccessMessage = (msg: string) => {
    setAdminSuccessMsg(msg);
    setTimeout(() => {
      setAdminSuccessMsg(null);
    }, 4000);
  };

  // Copy Blogger Iframe generator code
  const handleCopyGeneratorCode = () => {
    const origin = window.location.origin;
    const iframeCode = `<iframe src="${origin}/?embed=true&theme=${genTheme}&tab=${genDefaultTab}" width="100%" height="820" style="border: none; overflow: hidden; background: ${genTheme === 'dark' ? '#0f172a' : '#f8fafc'}; border-radius: 8px;" scrolling="no" title="Elections BiH 2026 Live"></iframe>`;
    navigator.clipboard.writeText(iframeCode);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Helper formatting numbers with thousands separators
  const formatVotes = (votes: number) => {
    return new Intl.NumberFormat('bs-BA').format(votes);
  };

  // Color classes helper for charts
  const getCandidateColor = (color: string) => {
    // If it's a hex color, return it directly inside inline style or use a default
    return color;
  };

  // Setup the proper layout based on embed parameters
  const isDark = isEmbed && embedTheme === 'dark';
  
  if (loading && !data) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex flex-col items-center space-y-4 p-8 max-w-sm text-center">
          <RefreshCw className="w-12 h-12 text-blue-900 animate-spin" />
          <h2 className="text-xl font-bold tracking-tight">Ažuriranje Rezultata Uživo</h2>
          <p className="text-sm text-slate-500">Učitavanje podataka iz centralnog API-ja za Opće izbore 2026...</p>
        </div>
      </div>
    );
  }

  // Get active canton data
  const currentCanton = data?.kantoni.find(k => k.id === selectedCantonId) || data?.kantoni[0];

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* 1. Header (Hidden in embed mode) */}
      {!isEmbed && (
        <header className="bg-slate-900 border-b border-slate-800 text-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Zone 1: Brand title, one line */}
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-ping shrink-0" />
                <h1 className="text-lg md:text-2xl font-bold tracking-tight">IZBORI BIH 2026</h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Uživo praćenje rezultata · Nezavisni portal</p>
            </div>

            {/* Zone 2: Informational updates / auto refresh label */}
            <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
              <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
                <span className={`w-2 h-2 rounded-full ${data?.simulationActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <span className="truncate max-w-[200px]">
                  {data?.simulationActive ? 'Live simulacija aktivna' : 'Zvanični izvor podataka'}
                </span>
              </div>
              
              <button 
                onClick={() => fetchElectionData(true)} 
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                title="Osvježi podatke"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-mono text-[11px]">
                  Zadnji refresh: {lastRefreshedAt.toLocaleTimeString('bs-BA')}
                </span>
              </button>
            </div>

            {/* Zone 3: Main Navigation CTAs / Admin Access */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setShowAdminPanel(!showAdminPanel);
                  if (!showAdminPanel) {
                    // Quick scroll to bottom admin panel
                    setTimeout(() => {
                      document.getElementById('admin-anchor')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                  showAdminPanel 
                    ? 'bg-blue-900 text-white border-blue-800' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
                {adminToken ? <Unlock className="w-3 h-3 text-emerald-400 ml-1" /> : <Lock className="w-3 h-3 text-slate-500 ml-1" />}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* 2. Global Status Message Banner */}
      {data?.statusMessage && (
        <div className={`border-b ${isDark ? 'bg-slate-900/50 border-slate-800 text-slate-300' : 'bg-yellow-50/70 border-yellow-100 text-slate-700'} py-2 px-4`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs gap-3">
            <span className="font-medium flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 bg-yellow-500 rounded-full" />
              {data.statusMessage}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
              Zadnji podaci: {new Date(data.lastUpdated).toLocaleString('bs-BA')}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`max-w-7xl mx-auto ${isEmbed ? 'p-2 md:p-3' : 'p-4 md:py-8 md:px-6'} space-y-6`}>
        
        {/* 3. Global Stats Overview (No pill tags, clean metadata list format) */}
        <section className={`grid grid-cols-2 md:grid-cols-4 gap-4 p-4 md:p-6 rounded-lg shadow-sm border ${
          isDark 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-white border-slate-100'
        }`}>
          <div className="space-y-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Obrađeno mjesta</div>
            <div className="text-xl md:text-3xl font-black font-mono tracking-tight text-blue-900 dark:text-blue-400">
              {data?.processedPollingStationsPercent}%
            </div>
            {/* Minimal unboxed metric label */}
            <div className="text-[10px] text-slate-400">
              {formatVotes(Math.round((data?.totalVoters || 0) * (data?.processedPollingStationsPercent || 0) / 100))} birača prebrojano
            </div>
            {/* Modern hairline progress bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded overflow-hidden mt-2">
              <div 
                className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500" 
                style={{ width: `${data?.processedPollingStationsPercent}%` }} 
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Ukupna Izlaznost</div>
            <div className="text-xl md:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-slate-100">
              {data?.overallTurnoutPercent}%
            </div>
            <div className="text-[10px] text-slate-400">
              Učešće od ukupnog biračkog tijela
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded overflow-hidden mt-2">
              <div 
                className="bg-amber-500 h-full transition-all duration-500" 
                style={{ width: `${data?.overallTurnoutPercent}%` }} 
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Ukupno birača</div>
            <div className="text-xl md:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-slate-100">
              {formatVotes(data?.totalVoters || 3418290)}
            </div>
            <div className="text-[10px] text-slate-400">
              Registrovani sa pravom glasa
            </div>
            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              <span>CIK BiH Centralni spisak</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Status ažuriranja</div>
            <div className="text-sm md:text-lg font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span>AUTOMATSKI UŽIVO</span>
            </div>
            <div className="text-[10px] text-slate-400 leading-tight">
              Podaci se ažuriraju automatski bez osvježavanja stranice
            </div>
            <div className="mt-1 flex gap-1.5">
              <button 
                onClick={() => setIsAutoRefreshing(!isAutoRefreshing)}
                className={`text-[9px] font-bold tracking-tight uppercase px-1.5 py-0.5 rounded transition-colors ${
                  isAutoRefreshing 
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {isAutoRefreshing ? 'Auto-refreš: UP' : 'Auto-refreš: DOWN'}
              </button>
            </div>
          </div>
        </section>

        {/* 4. Interactive Category Filter Tabs (Tailwind custom unboxed buttons) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveTab('predsjednistvo')}
              className={`px-3 py-2 text-xs md:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'predsjednistvo'
                  ? 'border-blue-900 text-blue-900 dark:border-yellow-400 dark:text-yellow-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300'
              }`}
            >
              <Vote className="w-4 h-4 shrink-0" />
              <span>Predsjedništvo BiH</span>
            </button>
            <button
              onClick={() => setActiveTab('parlament_bih')}
              className={`px-3 py-2 text-xs md:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'parlament_bih'
                  ? 'border-blue-900 text-blue-900 dark:border-yellow-400 dark:text-yellow-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Parlament BiH</span>
            </button>
            <button
              onClick={() => setActiveTab('parlament_fbih')}
              className={`px-3 py-2 text-xs md:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'parlament_fbih'
                  ? 'border-blue-900 text-blue-900 dark:border-yellow-400 dark:text-yellow-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Parlament FBiH</span>
            </button>
            <button
              onClick={() => setActiveTab('kantoni')}
              className={`px-3 py-2 text-xs md:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'kantoni'
                  ? 'border-blue-900 text-blue-900 dark:border-yellow-400 dark:text-yellow-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300'
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Skupštine Kantona</span>
            </button>
          </div>

          {!isEmbed && (
            <button
              onClick={() => setActiveTab('embed_generator')}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'embed_generator'
                  ? 'border-blue-900 text-blue-900 dark:border-yellow-400 dark:text-yellow-400'
                  : 'border-transparent text-blue-600 hover:text-blue-800'
              }`}
            >
              <Code className="w-4 h-4 shrink-0" />
              <span> Blogger Skripta</span>
            </button>
          )}
        </div>

        {/* 5. Main Tab Presentation Content */}
        
        {/* TAB 1: PREDSEDNISTVO */}
        {activeTab === 'predsjednistvo' && data && (
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h2 className="text-lg md:text-xl font-bold tracking-tight">Tročlano Predsjedništvo BiH</h2>
              <p className="text-xs text-slate-500 mt-1">Prva tri kandidata po broju osvojenih glasova u tri nacionalna bloka.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Bošnjački član */}
              <div className={`p-4 md:p-5 rounded-lg border shadow-sm flex flex-col justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                <div>
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex justify-between items-center">
                    <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 uppercase">Bošnjački član</h3>
                    <span className="text-[10px] text-slate-400">Federacija BiH</span>
                  </div>

                  <div className="space-y-5">
                    {data.predsjednistvo.bosnjacki.map((c, idx) => {
                      const isLeader = idx === 0 && c.votes > 0;
                      return (
                        <div key={c.id} className="space-y-1.5">
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <div className="font-semibold text-sm flex items-center gap-1">
                                <span>{c.name}</span>
                                {isLeader && (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 ml-1">
                                    · <span className="uppercase">Vodeći</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 truncate max-w-[180px]" title={c.party}>{c.partyShort}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                                {c.percent}%
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{formatVotes(c.votes)} glasova</div>
                            </div>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ 
                                width: `${c.percent}%`,
                                backgroundColor: getCandidateColor(c.color)
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 text-[10px] text-slate-400 text-center">
                  Suma glasova: {formatVotes(data.predsjednistvo.bosnjacki.reduce((s, c) => s + c.votes, 0))}
                </div>
              </div>

              {/* Hrvatski član */}
              <div className={`p-4 md:p-5 rounded-lg border shadow-sm flex flex-col justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                <div>
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex justify-between items-center">
                    <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 uppercase">Hrvatski član</h3>
                    <span className="text-[10px] text-slate-400">Federacija BiH</span>
                  </div>

                  <div className="space-y-5">
                    {data.predsjednistvo.hrvatski.map((c, idx) => {
                      const isLeader = idx === 0 && c.votes > 0;
                      return (
                        <div key={c.id} className="space-y-1.5">
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <div className="font-semibold text-sm flex items-center gap-1">
                                <span>{c.name}</span>
                                {isLeader && (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 ml-1">
                                    · <span className="uppercase">Vodeći</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 truncate max-w-[180px]" title={c.party}>{c.partyShort}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                                {c.percent}%
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{formatVotes(c.votes)} glasova</div>
                            </div>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ 
                                width: `${c.percent}%`,
                                backgroundColor: getCandidateColor(c.color)
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 text-[10px] text-slate-400 text-center">
                  Suma glasova: {formatVotes(data.predsjednistvo.hrvatski.reduce((s, c) => s + c.votes, 0))}
                </div>
              </div>

              {/* Srpski član */}
              <div className={`p-4 md:p-5 rounded-lg border shadow-sm flex flex-col justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                <div>
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex justify-between items-center">
                    <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 uppercase">Srpski član</h3>
                    <span className="text-[10px] text-slate-400">Republika Srpska</span>
                  </div>

                  <div className="space-y-5">
                    {data.predsjednistvo.srpski.map((c, idx) => {
                      const isLeader = idx === 0 && c.votes > 0;
                      return (
                        <div key={c.id} className="space-y-1.5">
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <div className="font-semibold text-sm flex items-center gap-1">
                                <span>{c.name}</span>
                                {isLeader && (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 ml-1">
                                    · <span className="uppercase">Vodeći</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 truncate max-w-[180px]" title={c.party}>{c.partyShort}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                                {c.percent}%
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{formatVotes(c.votes)} glasova</div>
                            </div>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ 
                                width: `${c.percent}%`,
                                backgroundColor: getCandidateColor(c.color)
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 text-[10px] text-slate-400 text-center">
                  Suma glasova: {formatVotes(data.predsjednistvo.srpski.reduce((s, c) => s + c.votes, 0))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: PARLAMENT BIH */}
        {activeTab === 'parlament_bih' && data && (
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h2 className="text-lg md:text-xl font-bold tracking-tight">Parlamentarna Skupština BiH</h2>
              <p className="text-xs text-slate-500 mt-1">Zastupnički dom BiH (Ukupno 42 zastupnika: FBiH 28, RS 14).</p>
            </div>

            {/* Estimated Seat Distribution Diagram */}
            <div className={`p-4 md:p-6 rounded-lg border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Projektovana raspodjela mandata (42 sjedišta)</h3>
              
              {/* Stacked Visual Bar for Seats */}
              <div className="w-full h-7 rounded-md overflow-hidden flex mb-6 bg-slate-100 dark:bg-slate-800">
                {data.parlamentBiH.map((p, idx) => {
                  const percentOfSeats = (p.estimatedSeats / 42) * 100;
                  if (p.estimatedSeats === 0) return null;
                  return (
                    <div 
                      key={p.shortName} 
                      className="h-full flex items-center justify-center text-[10px] font-bold text-white transition-all overflow-hidden"
                      style={{ 
                        width: `${percentOfSeats}%`, 
                        backgroundColor: p.color 
                      }}
                      title={`${p.name}: ${p.estimatedSeats} mandata`}
                    >
                      {p.estimatedSeats > 1 && <span>{p.shortName} ({p.estimatedSeats})</span>}
                    </div>
                  );
                })}
              </div>

              {/* Table list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Politička organizacija</th>
                      <th className="py-2.5 px-3 text-right">Ukupno Glasova</th>
                      <th className="py-2.5 px-3 text-right">Procenat (%)</th>
                      <th className="py-2.5 px-3 text-right">Proc. Mandati</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium">
                    {data.parlamentBiH.map((p) => (
                      <tr key={p.shortName} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-3 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: p.color }} />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{p.shortName}</span>
                            <span className="hidden sm:inline text-slate-400 font-normal ml-2">· {p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {formatVotes(p.votes)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {p.percent}%
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-blue-900 dark:text-yellow-400 text-sm">
                          {p.estimatedSeats}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PARLAMENT FBIH */}
        {activeTab === 'parlament_fbih' && data && (
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h2 className="text-lg md:text-xl font-bold tracking-tight">Parlament Federacije BiH</h2>
              <p className="text-xs text-slate-500 mt-1">Predstavnički dom Parlamenta FBiH (Ukupno 98 mandata).</p>
            </div>

            {/* FBiH Seat Distribution */}
            <div className={`p-4 md:p-6 rounded-lg border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Projektovana raspodjela mandata (98 sjedišta)</h3>
              
              <div className="w-full h-7 rounded-md overflow-hidden flex mb-6 bg-slate-100 dark:bg-slate-800">
                {data.parlamentFBiH.map((p) => {
                  const percentOfSeats = (p.estimatedSeats / 98) * 100;
                  if (p.estimatedSeats === 0) return null;
                  return (
                    <div 
                      key={p.shortName} 
                      className="h-full flex items-center justify-center text-[10px] font-bold text-white transition-all overflow-hidden"
                      style={{ 
                        width: `${percentOfSeats}%`, 
                        backgroundColor: p.color 
                      }}
                      title={`${p.name}: ${p.estimatedSeats} mandata`}
                    >
                      {p.estimatedSeats > 3 && <span>{p.shortName} ({p.estimatedSeats})</span>}
                    </div>
                  );
                })}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Politička organizacija</th>
                      <th className="py-2.5 px-3 text-right">Glasovi</th>
                      <th className="py-2.5 px-3 text-right">Procenat</th>
                      <th className="py-2.5 px-3 text-right">Projektovani Mandati</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium">
                    {data.parlamentFBiH.map((p) => (
                      <tr key={p.shortName} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-3 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: p.color }} />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{p.shortName}</span>
                            <span className="hidden sm:inline text-slate-400 font-normal ml-2">· {p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {formatVotes(p.votes)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {p.percent}%
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-blue-900 dark:text-yellow-400 text-sm">
                          {p.estimatedSeats}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: KANTONI */}
        {activeTab === 'kantoni' && data && (
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h2 className="text-lg md:text-xl font-bold tracking-tight">Rezultati po kantonima (Federacija BiH)</h2>
              <p className="text-xs text-slate-500 mt-1">Praćenje i filtriranje izbornih rezultata za skupštine svih deset kantona pojedinačno.</p>
            </div>

            {/* Canton Selector segmented buttons */}
            <div className={`p-4 rounded-lg border shadow-sm space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-2">Odaberite kanton</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {data.kantoni.map((canton) => (
                    <button
                      key={canton.id}
                      onClick={() => setSelectedCantonId(canton.id)}
                      className={`px-3 py-2 text-xs font-semibold rounded border transition-all text-center ${
                        selectedCantonId === canton.id
                          ? 'bg-blue-900 text-white border-blue-950 dark:bg-yellow-400 dark:text-slate-950 dark:border-yellow-400 font-bold shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {canton.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual Selected Canton Info Card */}
              {currentCanton && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 space-y-4">
                  {/* Metadata Row */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs text-slate-500 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 text-sm">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{currentCanton.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono">
                      <span>Registrovani birači: <strong className="text-slate-800 dark:text-slate-200">{formatVotes(currentCanton.totalVoters)}</strong></span>
                      <span>·</span>
                      <span>Izlaznost kanton: <strong className="text-slate-800 dark:text-slate-200">{currentCanton.turnoutPercent}%</strong></span>
                      <span>·</span>
                      <span>Obrađeno mjesta: <strong className="text-blue-600 dark:text-yellow-400">{currentCanton.processedPercent}%</strong></span>
                    </div>
                  </div>

                  {/* Canton Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-2 px-3">Politička partija</th>
                          <th className="py-2 px-3 text-right">Osvojeni Glasovi</th>
                          <th className="py-2 px-3 text-right">Udio (%)</th>
                          <th className="py-2 px-3">Odnos / Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium">
                        {currentCanton.parties.map((p, pIdx) => (
                          <tr key={p.shortName} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                            <td className="py-3 px-3 flex items-center gap-2">
                              <span className="w-2 h-2 rounded shrink-0" style={{ backgroundColor: p.color }} />
                              <span className="font-bold text-slate-900 dark:text-slate-100">{p.shortName}</span>
                              <span className="hidden md:inline text-slate-400 font-normal">· {p.name}</span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {formatVotes(p.votes)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              {p.percent}%
                            </td>
                            <td className="py-3 px-3 min-w-[120px] w-1/3">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full"
                                    style={{ 
                                      width: `${p.percent}%`,
                                      backgroundColor: p.color
                                    }}
                                  />
                                </div>
                                {pIdx === 0 && p.votes > 0 && (
                                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight shrink-0">LIDER</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: EMBED CODE GENERATOR */}
        {activeTab === 'embed_generator' && !isEmbed && (
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h2 className="text-lg md:text-xl font-bold tracking-tight">Blogger Skripta i Integracija</h2>
              <p className="text-xs text-slate-500 mt-1">Prilagodite izgled i preuzmite HTML embed skriptu koju možete umetnuti u bilo koji post ili widget na vašem Blogger portalu.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Settings Form */}
              <div className={`lg:col-span-5 p-5 rounded-lg border shadow-sm space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase pb-2 border-b border-slate-100 dark:border-slate-800">Postavke integracije</h3>
                
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Boja teme (Theme)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setGenTheme('light')}
                      className={`px-3 py-2 text-xs font-medium rounded border ${genTheme === 'light' ? 'bg-slate-100 border-slate-300 font-bold' : 'bg-slate-50 border-slate-200'}`}
                    >
                      Svijetla (Light)
                    </button>
                    <button 
                      onClick={() => setGenTheme('dark')}
                      className={`px-3 py-2 text-xs font-medium rounded border ${genTheme === 'dark' ? 'bg-slate-950 border-slate-700 text-white font-bold' : 'bg-slate-50 border-slate-200'}`}
                    >
                      Tamna (Dark)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Početni tab pri učitavanju</label>
                  <select 
                    value={genDefaultTab} 
                    onChange={(e) => setGenDefaultTab(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900"
                  >
                    <option value="predsjednistvo">Predsjedništvo BiH</option>
                    <option value="parlament_bih">Parlament BiH</option>
                    <option value="parlament_fbih">Parlament FBiH</option>
                    <option value="kantoni">Skupštine Kantona</option>
                  </select>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    Ugrađeni prozor (iframe) je u potpunosti <strong>responzivan</strong> i automatski se prilagođava mobilnim telefonima, tabletima i ekranima računara. Podaci se ažuriraju u pozadini bez ponovnog učitavanja bloga.
                  </div>
                </div>

                <button 
                  onClick={handleCopyGeneratorCode}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded bg-blue-900 text-yellow-400 hover:bg-blue-950 transition-colors font-bold text-xs shadow-sm"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>KOD JE KOPIRAN!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>KOPIRAJ HTML SKRIPTU</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code preview block */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                <div className={`p-5 rounded-lg border shadow-sm flex-1 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                }`}>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase pb-2 border-b border-slate-100 dark:border-slate-800 mb-3">Generisani Blogger kod</h3>
                  
                  <div className="bg-slate-950 text-slate-300 p-4 rounded font-mono text-[11px] overflow-x-auto leading-normal whitespace-pre-wrap select-all">
                    {`<iframe src="${window.location.origin}/?embed=true&theme=${genTheme}&tab=${genDefaultTab}" width="100%" height="820" style="border: none; overflow: hidden; background: ${genTheme === 'dark' ? '#0f172a' : '#f8fafc'}; border-radius: 8px;" scrolling="no" title="Izbori BiH 2026 Live"></iframe>`}
                  </div>
                  
                  <div className="text-xs text-slate-500 mt-4 space-y-2">
                    <p className="font-semibold">Uputstvo za Blogger instalaciju:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Prijavite se na vaš Blogger.com račun.</li>
                      <li>Otvorite članak u kojem želite prikazati rezultate ili kreirajte novi post.</li>
                      <li>U gornjem lijevom uglu uređivača teksta promijenite režim sa <strong>Prikaz za pisanje</strong> u <strong>HTML prikaz</strong> (&lt;&gt; ikonica).</li>
                      <li>Zalijepite kopiranu skriptu na mjesto gdje želite da se tabela pojavi.</li>
                      <li>Kliknite na <strong>Objavi / Ažuriraj</strong>.</li>
                    </ol>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* 6. Admin Control Center Toggle & Anchor */}
      <span id="admin-anchor" />
      {showAdminPanel && (
        <section className={`max-w-7xl mx-auto p-4 md:px-6 pb-12`}>
          <div className={`p-5 md:p-8 rounded-lg border shadow-lg ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-100 border-slate-300 text-slate-900'
          }`}>
            
            {/* Header */}
            <div className="border-b border-slate-300 dark:border-slate-700 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-900 dark:text-yellow-400" />
                <h2 className="text-base md:text-lg font-bold uppercase tracking-wide">Administrativni Dashboard (Uživo Kontrola)</h2>
              </div>
              
              {adminToken && (
                <button 
                  onClick={handleAdminLogout}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors"
                >
                  Odjava sa panela
                </button>
              )}
            </div>

            {/* Success toast notification inside admin panel */}
            {adminSuccessMsg && (
              <div className="mb-4 bg-emerald-100 border border-emerald-400 text-emerald-800 px-4 py-3 rounded text-xs font-bold transition-all animate-bounce">
                {adminSuccessMsg}
              </div>
            )}

            {/* Step 1: LOGIN REQUIREMENT */}
            {!adminToken ? (
              <form onSubmit={handleAdminLogin} className="max-w-md mx-auto space-y-4 py-4 text-center">
                <div className="text-xs text-slate-500 mb-2">
                  Unesite administrativnu lozinku da biste upravljali rezultatima, mijenjali procente i aktivirali automatsku simulaciju.
                </div>
                
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-left text-slate-400">Lozinka (Default: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-red-600 font-mono">izbori2026</code>)</label>
                  <input 
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Unesite lozinku..."
                    className="w-full p-2 text-sm rounded border border-slate-300 dark:bg-slate-950 dark:text-white dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900"
                    required
                  />
                </div>

                {loginError && (
                  <div className="text-xs text-red-600 font-bold flex items-center gap-1 justify-center">
                    <AlertCircle className="w-4 h-4" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="w-full py-2 bg-blue-900 text-yellow-400 font-bold text-xs rounded hover:bg-blue-950 transition-colors shadow-sm"
                >
                  Pristupi kontrolnoj tabli
                </button>
              </form>
            ) : (
              
              /* Step 2: AUTHENTICATED PANEL */
              <div className="space-y-8">
                
                {/* Simulator Live Module */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded bg-slate-200 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                  <div className="space-y-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Automatska Simulacija Glasanja</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Uključite automatski režim gdje server svake 3 sekunde nasumično uvećava procenat obrađenih mjesta i dodjeljuje realne glasove proporcionalno po utrkama. Odlično za simuliranje noći izbora uživo na blogovima!
                    </p>
                  </div>

                  <div className="flex flex-col justify-center space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Simulator status:</span>
                      <strong className={`text-xs ${data?.simulationActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                        {data?.simulationActive ? 'AKTIVAN (Ticking)' : 'ZAUSTAVLJEN'}
                      </strong>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleToggleSimulation(true, data?.simulationSpeed || 2)}
                        disabled={data?.simulationActive}
                        className={`flex-1 py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          data?.simulationActive 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Pokreni</span>
                      </button>

                      <button 
                        onClick={() => handleToggleSimulation(false)}
                        disabled={!data?.simulationActive}
                        className={`flex-1 py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          !data?.simulationActive 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                            : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                        }`}
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Zaustavi</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center space-y-3">
                    <div className="text-xs font-bold">Simulacijska brzina:</div>
                    <div className="flex gap-1">
                      {[1, 2, 5].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => handleToggleSimulation(data?.simulationActive || false, speed)}
                          className={`flex-1 py-1 text-xs rounded font-bold font-mono transition-colors ${
                            data?.simulationSpeed === speed
                              ? 'bg-blue-900 text-yellow-400'
                              : 'bg-slate-300 dark:bg-slate-850 hover:bg-slate-400 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                    <span className="text-[9px] text-slate-400 text-center italic">Brzina diktira veličinu prirasta glasova po sekundi.</span>
                  </div>
                </div>

                {/* Reset & Quick Presets */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded bg-slate-200 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Brze Akcije i Reset</h3>
                    <p className="text-[11px] text-slate-500">Resetujte bazu podataka na nulu da biste počeli simulaciju od samog početka izbora ili učitajte početne realne procjene.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleResetData('seed')}
                      className="flex-1 py-1.5 px-3 bg-blue-950 hover:bg-blue-900 text-yellow-400 text-xs font-bold rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Učitaj početno stanje (CIK)</span>
                    </button>
                    <button 
                      onClick={() => handleResetData('zero')}
                      className="flex-1 py-1.5 px-3 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Očisti na NULU (0 glasova)</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Sub-Sections for editing candidates */}
                <div className="space-y-4">
                  
                  {/* Category switcher for editing */}
                  <div className="flex flex-wrap gap-1 border-b border-slate-300 dark:border-slate-700 pb-1">
                    <button 
                      onClick={() => setSelectedEditCategory('settings')}
                      className={`px-3 py-1.5 text-xs font-bold rounded ${selectedEditCategory === 'settings' ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-950' : 'hover:bg-slate-300 text-slate-600 dark:text-slate-300'}`}
                    >
                      Glavne Postavke
                    </button>
                    <button 
                      onClick={() => setSelectedEditCategory('predsjednistvo')}
                      className={`px-3 py-1.5 text-xs font-bold rounded ${selectedEditCategory === 'predsjednistvo' ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-950' : 'hover:bg-slate-300 text-slate-600 dark:text-slate-300'}`}
                    >
                      Predsjedništvo BiH
                    </button>
                    <button 
                      onClick={() => setSelectedEditCategory('parlament_bih')}
                      className={`px-3 py-1.5 text-xs font-bold rounded ${selectedEditCategory === 'parlament_bih' ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-950' : 'hover:bg-slate-300 text-slate-600 dark:text-slate-300'}`}
                    >
                      Parlament BiH
                    </button>
                    <button 
                      onClick={() => setSelectedEditCategory('parlament_fbih')}
                      className={`px-3 py-1.5 text-xs font-bold rounded ${selectedEditCategory === 'parlament_fbih' ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-950' : 'hover:bg-slate-300 text-slate-600 dark:text-slate-300'}`}
                    >
                      Parlament FBiH
                    </button>
                    <button 
                      onClick={() => setSelectedEditCategory('kantoni')}
                      className={`px-3 py-1.5 text-xs font-bold rounded ${selectedEditCategory === 'kantoni' ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-950' : 'hover:bg-slate-300 text-slate-600 dark:text-slate-300'}`}
                    >
                      Kantoni (10)
                    </button>
                  </div>

                  {/* SUB PANEL 1: SETTINGS */}
                  {selectedEditCategory === 'settings' && (
                    <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Opće postavke izbora</h4>
                      
                      <div className="space-y-1">
                        <label className="block text-xs font-bold uppercase text-slate-400">Tekst / Informacija na vrhu</label>
                        <input 
                          type="text"
                          value={tempStatusMessage}
                          onChange={(e) => setTempStatusMessage(e.target.value)}
                          className="w-full text-xs p-2 rounded border dark:bg-slate-950 border-slate-300"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold uppercase text-slate-400">Reg. glasači</label>
                          <input 
                            type="number"
                            value={tempTotalVoters}
                            onChange={(e) => setTempTotalVoters(Number(e.target.value))}
                            className="w-full text-xs p-2 rounded border dark:bg-slate-950 border-slate-300"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold uppercase text-slate-400">Ukupna Izlaznost (%)</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={tempTurnout}
                            onChange={(e) => setTempTurnout(Number(e.target.value))}
                            className="w-full text-xs p-2 rounded border dark:bg-slate-950 border-slate-300"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold uppercase text-slate-400">Obrađeno mjesta (%)</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={tempProcessed}
                            onChange={(e) => setTempProcessed(Number(e.target.value))}
                            className="w-full text-xs p-2 rounded border dark:bg-slate-950 border-slate-300"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors shadow-sm"
                      >
                        Snimi opće postavke
                      </button>
                    </form>
                  )}

                  {/* SUB PANEL 2: PREDSEDNISTVO */}
                  {selectedEditCategory === 'predsjednistvo' && data && (
                    <div className="space-y-6 max-w-3xl">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Unos glasova za Predsjedništvo BiH</h4>
                      
                      {['bosnjacki', 'hrvatski', 'srpski'].map((raceKey) => (
                        <div key={raceKey} className="border-b border-slate-300 dark:border-slate-800 pb-4 last:border-0">
                          <h5 className="font-bold text-xs text-blue-900 dark:text-yellow-400 uppercase mb-2">{raceKey} član</h5>
                          <div className="space-y-2">
                            {data.predsjednistvo[raceKey as 'bosnjacki' | 'hrvatski' | 'srpski'].map((c) => (
                              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded bg-slate-300/40 dark:bg-slate-950/40 text-xs">
                                <div>
                                  <strong>{c.name}</strong> <span className="text-slate-400">({c.partyShort})</span>
                                  <div className="text-[10px] text-slate-400">Trenutno: {formatVotes(c.votes)} gl. ({c.percent}%)</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number"
                                    defaultValue={c.votes}
                                    id={`input-${c.id}`}
                                    className="p-1 w-28 text-right font-mono font-bold border rounded dark:bg-slate-900 dark:text-white"
                                  />
                                  <button
                                    onClick={() => {
                                      const inputVal = (document.getElementById(`input-${c.id}`) as HTMLInputElement)?.value;
                                      handleUpdateVotes('predsjednistvo', Number(inputVal), c.id);
                                    }}
                                    className="py-1 px-3 bg-blue-900 text-yellow-400 hover:bg-blue-950 font-bold rounded"
                                  >
                                    Ažuriraj
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SUB PANEL 3: PARLAMENT BIH */}
                  {selectedEditCategory === 'parlament_bih' && data && (
                    <div className="space-y-3 max-w-2xl">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Glasovi za Parlament BiH</h4>
                      {data.parlamentBiH.map((p) => (
                        <div key={p.shortName} className="flex items-center justify-between gap-2 p-2 rounded bg-slate-300/40 dark:bg-slate-950/40 text-xs">
                          <div>
                            <strong>{p.shortName}</strong> <span className="text-slate-400">({p.name})</span>
                            <div className="text-[10px] text-slate-400">Trenutno: {formatVotes(p.votes)} gl. ({p.percent}%)</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              defaultValue={p.votes}
                              id={`input-pBiH-${p.shortName}`}
                              className="p-1 w-28 text-right font-mono font-bold border rounded dark:bg-slate-900 dark:text-white"
                            />
                            <button
                              onClick={() => {
                                const val = (document.getElementById(`input-pBiH-${p.shortName}`) as HTMLInputElement)?.value;
                                handleUpdateVotes('parlamentBiH', Number(val), undefined, p.shortName);
                              }}
                              className="py-1 px-3 bg-blue-900 text-yellow-400 hover:bg-blue-950 font-bold rounded"
                            >
                              Ažuriraj
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SUB PANEL 4: PARLAMENT FBIH */}
                  {selectedEditCategory === 'parlament_fbih' && data && (
                    <div className="space-y-3 max-w-2xl">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Glasovi za Parlament FBiH</h4>
                      {data.parlamentFBiH.map((p) => (
                        <div key={p.shortName} className="flex items-center justify-between gap-2 p-2 rounded bg-slate-300/40 dark:bg-slate-950/40 text-xs">
                          <div>
                            <strong>{p.shortName}</strong> <span className="text-slate-400">({p.name})</span>
                            <div className="text-[10px] text-slate-400">Trenutno: {formatVotes(p.votes)} gl. ({p.percent}%)</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              defaultValue={p.votes}
                              id={`input-pFBiH-${p.shortName}`}
                              className="p-1 w-28 text-right font-mono font-bold border rounded dark:bg-slate-900 dark:text-white"
                            />
                            <button
                              onClick={() => {
                                const val = (document.getElementById(`input-pFBiH-${p.shortName}`) as HTMLInputElement)?.value;
                                handleUpdateVotes('parlamentFBiH', Number(val), undefined, p.shortName);
                              }}
                              className="py-1 px-3 bg-blue-900 text-yellow-400 hover:bg-blue-950 font-bold rounded"
                            >
                              Ažuriraj
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SUB PANEL 5: KANTONI */}
                  {selectedEditCategory === 'kantoni' && data && (
                    <div className="space-y-6 max-w-3xl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Unos glasova po kantonima</h4>
                        
                        {/* Canton edit selector dropdown */}
                        <select 
                          value={selectedCantonId}
                          onChange={(e) => setSelectedCantonId(Number(e.target.value))}
                          className="text-xs p-1.5 rounded border dark:bg-slate-950"
                        >
                          {data.kantoni.map((canton) => (
                            <option key={canton.id} value={canton.id}>{canton.name}</option>
                          ))}
                        </select>
                      </div>

                      {currentCanton && (
                        <div className="space-y-4 p-4 rounded bg-slate-200/50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-800">
                          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">{currentCanton.name} — Postavke i rezultati</h5>
                          
                          {/* Canton metadata inputs */}
                          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-300 dark:border-slate-800">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold uppercase text-slate-400">Obrađeno mjesta kanton (%)</label>
                              <input 
                                type="number" 
                                step="0.1"
                                defaultValue={currentCanton.processedPercent}
                                id={`canton-meta-proc-${currentCanton.id}`}
                                className="w-full text-xs p-1.5 rounded border dark:bg-slate-950"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold uppercase text-slate-400">Izlaznost kanton (%)</label>
                              <input 
                                type="number" 
                                step="0.1"
                                defaultValue={currentCanton.turnoutPercent}
                                id={`canton-meta-turn-${currentCanton.id}`}
                                className="w-full text-xs p-1.5 rounded border dark:bg-slate-950"
                              />
                            </div>
                            <div className="col-span-2 text-right">
                              <button
                                onClick={() => {
                                  const procVal = Number((document.getElementById(`canton-meta-proc-${currentCanton.id}`) as HTMLInputElement)?.value);
                                  const turnVal = Number((document.getElementById(`canton-meta-turn-${currentCanton.id}`) as HTMLInputElement)?.value);
                                  handleUpdateCantonMeta(currentCanton.id, procVal, turnVal);
                                }}
                                className="py-1 px-3 bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs rounded"
                              >
                                Sačuvaj metapodatke kantona
                              </button>
                            </div>
                          </div>

                          {/* Canton parties lists */}
                          <div className="space-y-2 pt-2">
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2">Snimanje glasova za stranke</label>
                            {currentCanton.parties.map((p) => (
                              <div key={p.shortName} className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-300/40 dark:bg-slate-950/40 text-xs">
                                <div>
                                  <strong>{p.shortName}</strong> <span className="text-slate-400">({p.name})</span>
                                  <div className="text-[10px] text-slate-400">Trenutno: {formatVotes(p.votes)} gl. ({p.percent}%)</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number"
                                    defaultValue={p.votes}
                                    id={`input-canton-${currentCanton.id}-${p.shortName}`}
                                    className="p-1 w-24 text-right font-mono font-bold border rounded dark:bg-slate-900 dark:text-white"
                                  />
                                  <button
                                    onClick={() => {
                                      const val = (document.getElementById(`input-canton-${currentCanton.id}-${p.shortName}`) as HTMLInputElement)?.value;
                                      handleUpdateVotes('canton', Number(val), undefined, p.shortName, currentCanton.id);
                                    }}
                                    className="py-1 px-2.5 bg-blue-900 text-yellow-400 hover:bg-blue-950 font-bold rounded"
                                  >
                                    Snimi
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>
            )}

          </div>
        </section>
      )}

      {/* 7. Footer */}
      <footer className={`border-t py-6 px-4 text-center text-xs ${
        isDark ? 'bg-slate-950 border-slate-900 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-600'
      }`}>
        <div className="max-w-7xl mx-auto space-y-2">
          <div>
            <strong>Uživo Praćenje Rezultata Općih Izbora u BiH 2026.</strong>
          </div>
          <div className="flex justify-center items-center gap-2 text-[11px]">
            <span>Automatski sistem obrade podataka</span>
            <span>·</span>
            <span>Prilagođeno za ugradnju na Blogger portale</span>
            <span>·</span>
            <span>Ažurirano svakih 5s</span>
          </div>
          <div className="text-[10px] text-slate-400 pt-2">
            Zasnovano na zvaničnim procedurama prikupljanja glasova s biračkih mjesta u Bosni i Hercegovini.
          </div>
        </div>
      </footer>

    </div>
  );
}
