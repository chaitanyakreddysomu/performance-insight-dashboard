import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Check, ChevronDown,
  ChevronRight, CircleHelp, Clock3, Factory, Gauge, Layers3, LoaderCircle, RefreshCw,
  Search, Settings2, SlidersHorizontal, Wifi, X,
} from 'lucide-react';

type AnyRecord = Record<string, any>;
type Point = { timestamp: string; value: number | string; qualitycode?: number };
type Asset = AnyRecord;
type Signal = AnyRecord;
type ApiSettings = { baseUrl: string; credentials: boolean };

const storedSettings: ApiSettings = {
  baseUrl: localStorage.getItem('iihBase') || '',
  credentials: localStorage.getItem('iihCredentials') !== 'false',
};
const unwrap = (value: any): any[] => Array.isArray(value) ? value :
  Array.isArray(value?.data) ? value.data : Array.isArray(value?.items) ? value.items :
    Array.isArray(value?.assets) ? value.assets : Array.isArray(value?.variables) ? value.variables : [];
const idOf = (value?: AnyRecord) => value?.id ?? value?.anchor ?? value?.['$anchor'] ?? value?.variableId ?? value?.assetId ?? '';
const nameOf = (value?: AnyRecord) => value?.name ?? value?.displayName ?? value?.label ?? value?.['$anchor'] ?? 'Unnamed';
const formatTime = (raw?: string) => raw ? new Date(raw).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

async function apiGet<T>(baseUrl: string, path: string, credentials: boolean): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
      credentials: credentials ? 'include' : 'omit',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('The browser could not reach IIH Essentials. Check the device URL, network and CORS settings.');
  }
  const raw = await response.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = raw; }
  if (!response.ok) throw new Error(data?.message || `IIH Essentials returned HTTP ${response.status}.`);
  return data as T;
}

function App() {
  const [settings, setSettings] = useState<ApiSettings>(storedSettings);
  const [draftUrl, setDraftUrl] = useState(storedSettings.baseUrl);
  const [draftCredentials, setDraftCredentials] = useState(storedSettings.credentials);
  const [showSettings, setShowSettings] = useState(false);
  const [connection, setConnection] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [series, setSeries] = useState<Record<string, Point[]>>({});
  const [selectedSignal, setSelectedSignal] = useState('');
  const [rangeHours, setRangeHours] = useState(24);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const activeSignal = useMemo(() => signals.find((signal) => idOf(signal) === selectedSignal) ?? signals[0], [signals, selectedSignal]);
  const activePoints = activeSignal ? series[idOf(activeSignal)] ?? [] : [];
  const values = activePoints.map((point) => Number(point.value)).filter(Number.isFinite);
  const latestValue = values.length ? values[values.length - 1] : undefined;
  const average = values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : undefined;
  const low = values.length ? Math.min(...values) : undefined;
  const high = values.length ? Math.max(...values) : undefined;
  const filteredSignals = useMemo(() => signals.filter((signal) => {
    const assetId = signal.assetId ?? signal.asset?.id ?? signal.parentId;
    const assetName = assets.find((asset) => idOf(asset) === assetId)?.name ?? signal.assetName ?? '';
    return `${nameOf(signal)} ${assetName} ${signal.unit ?? ''}`.toLowerCase().includes(search.toLowerCase());
  }), [signals, assets, search]);

  async function loadDashboard(nextSettings = settings) {
    if (!nextSettings.baseUrl.trim()) { setShowSettings(true); return; }
    setConnection('connecting'); setError('');
    try {
      const assetResult = await apiGet<unknown>(nextSettings.baseUrl, '/DataService/anchor/v1/assets?take=1000', nextSettings.credentials);
      const signalResult = await apiGet<unknown>(nextSettings.baseUrl, '/DataService/Variables', nextSettings.credentials);
      const nextAssets = unwrap(assetResult) as Asset[];
      const nextSignals = unwrap(signalResult) as Signal[];
      setAssets(nextAssets); setSignals(nextSignals);
      if (!selectedSignal && nextSignals[0]) setSelectedSignal(idOf(nextSignals[0]));
      setConnection('connected'); setLastUpdated(new Date());
      await loadSeries(nextSettings, nextSignals, rangeHours);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to connect to IIH Essentials.';
      setError(message); setConnection('error');
    }
  }

  async function loadSeries(nextSettings = settings, sourceSignals = signals, hours = rangeHours) {
    const ids = sourceSignals.map(idOf).filter(Boolean).slice(0, 100);
    if (!ids.length) { setSeries({}); return; }
    const to = new Date(); const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    const params = new URLSearchParams({ variableIds: JSON.stringify(ids), from: from.toISOString(), to: to.toISOString(), limit: '100' });
    try {
      const result = await apiGet<unknown>(nextSettings.baseUrl, `/DataService/Data?${params}`, nextSettings.credentials);
      const next: Record<string, Point[]> = {};
      for (const item of unwrap(result)) next[item.variableId ?? item.id] = item.values ?? [];
      setSeries(next); setLastUpdated(new Date());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to read signal values.');
    }
  }

  useEffect(() => { if (settings.baseUrl) void loadDashboard(); /* restore saved device on first render */ // eslint-disable-line react-hooks/exhaustive-deps
  }, []);

  function saveAndConnect() {
    const trimmed = draftUrl.trim().replace(/\/+$/, '');
    try { new URL(trimmed); } catch { setError('Enter a full URL such as https://192.168.1.10/iih-essentials.'); return; }
    const next = { baseUrl: trimmed, credentials: draftCredentials };
    localStorage.setItem('iihBase', next.baseUrl); localStorage.setItem('iihCredentials', String(next.credentials));
    setSettings(next); setShowSettings(false); setSelectedSignal(''); void loadDashboard(next);
  }

  const connected = connection === 'connected';
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="product"><span className="product-symbol"><Activity size={17} /></span><span>Performance Insight <em>Operator Dashboard</em></span></div>
        <div className="topbar-right"><span className={`connection-pill ${connected ? 'is-online' : ''}`}><i />{connected ? 'CONNECTED' : connection === 'connecting' ? 'CONNECTING' : 'NOT CONNECTED'}</span><span className="clock-label"><Clock3 size={14} />{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live operations'}</span><button className="top-icon" title="Connection settings" onClick={() => setShowSettings(true)}><Settings2 size={18} /></button></div>
      </header>

      <main className="dashboard">
        <section className="status-strip">
          <div className="status-cell"><span className="status-label">DEVICE</span><span className="status-value"><span className={`device-led ${connected ? 'online' : ''}`} />{settings.baseUrl ? settings.baseUrl.replace(/^https?:\/\//, '') : 'IIH Essentials not configured'}</span></div>
          <span className="strip-divider" />
          <div className="status-cell"><span className="status-label">ASSETS</span><span className="status-value">{assets.length || '—'}</span></div>
          <span className="strip-divider" />
          <div className="status-cell"><span className="status-label">SIGNALS</span><span className="status-value">{signals.length || '—'}</span></div>
          <div className="status-spacer" />
          <label className="range-picker"><span>RANGE</span><select value={rangeHours} onChange={(event) => { const next = Number(event.target.value); setRangeHours(next); if (connected) void loadSeries(settings, signals, next); }}><option value={1}>Last hour</option><option value={24}>Last 24 hours</option><option value={168}>Last 7 days</option></select><ChevronDown size={14} /></label>
          <button className="refresh-button" onClick={() => void loadDashboard()} disabled={connection === 'connecting'}><RefreshCw size={14} className={connection === 'connecting' ? 'spin' : ''} />Refresh</button>
        </section>

        {error && <div className="error-banner"><AlertCircle size={16} /><span>{error}</span><button onClick={() => setShowSettings(true)}>Review connection</button><button className="dismiss" aria-label="Dismiss" onClick={() => setError('')}><X size={15} /></button></div>}

        {!connected && connection !== 'connecting' && <section className="connect-callout"><div className="callout-icon"><Wifi size={18} /></div><div><b>Connect your plant data</b><span>Connect to IIH Essentials to see assets, signals and live readings on this dashboard.</span></div><button className="blue-button" onClick={() => { setDraftUrl(settings.baseUrl); setShowSettings(true); }}>Configure connection <ChevronRight size={15} /></button></section>}

        <section className="overview-row">
          <article className="summary-card"><div className="card-title-line"><div><div className="section-kicker">PLANT OVERVIEW</div><h1>Operations at a glance</h1></div><span className="subtle-tag"><Factory size={13} /> IIH Essentials</span></div><p className="summary-description">Live visibility into your connected assets and process signals.</p><div className="summary-stats"><div><span className="summary-number">{assets.length || '—'}</span><span className="summary-label">Assets</span></div><div><span className="summary-number">{signals.length || '—'}</span><span className="summary-label">Configured signals</span></div><div><span className="summary-number">{Object.keys(series).length || '—'}</span><span className="summary-label">Signals reporting</span></div></div><div className="summary-footer"><span><span className={`mini-status ${connected ? 'ok' : ''}`} />{connected ? 'Device connection healthy' : 'Waiting for device connection'}</span><span>{lastUpdated ? `Last sync ${formatTime(lastUpdated.toISOString())}` : 'No data received yet'}</span></div></article>
          <article className="signal-card"><div className="card-title-line"><div><div className="section-kicker">LIVE SIGNAL</div><h2>Selected process value</h2></div><span className="live-tag"><i /> LIVE</span></div><div className="signal-select-wrap"><select value={activeSignal ? idOf(activeSignal) : ''} onChange={(event) => setSelectedSignal(event.target.value)} disabled={!signals.length}><option value="">{signals.length ? 'Choose a signal' : 'Connect to load signals'}</option>{signals.map((signal) => <option key={idOf(signal)} value={idOf(signal)}>{nameOf(signal)}</option>)}</select><ChevronDown size={15} /></div><div className="live-reading"><strong>{latestValue === undefined ? '—' : Number(latestValue.toFixed(3)).toLocaleString()}</strong><span>{activeSignal?.unit || 'value'}</span>{values.length > 1 && (values.at(-1)! >= values.at(-2)! ? <ArrowUpRight className="trend-up" size={17} /> : <ArrowDownRight className="trend-down" size={17} />)}</div><div className="signal-name">{activeSignal ? nameOf(activeSignal) : 'No signal selected'}</div><MiniChart values={values} /><div className="reading-foot"><span><i />Latest reading</span><span>{activePoints.length ? formatTime(activePoints.at(-1)?.timestamp) : 'No recent readings'}</span></div></article>
        </section>

        <section className="metric-row">
          <MetricCard label="CURRENT VALUE" value={latestValue === undefined ? '—' : Number(latestValue.toFixed(2)).toLocaleString()} unit={activeSignal?.unit || 'Select a signal'} caption={activeSignal ? nameOf(activeSignal) : 'Live reading'} icon={<Gauge size={16} />} accent="blue" />
          <MetricCard label="AVERAGE" value={average === undefined ? '—' : Number(average.toFixed(2)).toLocaleString()} unit={activeSignal?.unit || ''} caption={`Across ${activePoints.length} readings`} icon={<BarChart3 size={16} />} accent="green" />
          <MetricCard label="LOW · HIGH" value={low === undefined ? '—' : `${Number(low.toFixed(2))} – ${Number(high!.toFixed(2))}`} unit={activeSignal?.unit || ''} caption="Selected time range" icon={<SlidersHorizontal size={16} />} accent="orange" />
          <MetricCard label="DATA POINTS" value={activePoints.length || '—'} unit="readings" caption={rangeHours === 1 ? 'Last hour' : rangeHours === 24 ? 'Last 24 hours' : 'Last 7 days'} icon={<Layers3 size={16} />} accent="purple" />
        </section>

        <section className="lower-grid">
          <article className="panel signals-panel"><div className="panel-heading"><div><div className="section-kicker">PROCESS DATA</div><h2>Signal monitor</h2><p>Live values from IIH Essentials</p></div><div className="table-actions"><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search signals" /></label><button className="outline-button" onClick={() => void loadSeries()}><RefreshCw size={13} /> Update</button></div></div><div className="table-scroll"><table><thead><tr><th>SIGNAL</th><th>ASSET</th><th>LATEST VALUE</th><th>UNIT</th><th>QUALITY</th><th>LAST UPDATE</th><th /></tr></thead><tbody>{filteredSignals.slice(0, 60).map((signal) => {
            const signalId = idOf(signal); const data = series[signalId] ?? []; const last = data.at(-1); const assetId = signal.assetId ?? signal.asset?.id ?? signal.parentId; const assetName = assets.find((asset) => idOf(asset) === assetId)?.name ?? signal.assetName ?? '—'; const selected = idOf(activeSignal) === signalId;
            return <tr key={signalId} className={selected ? 'selected-row' : ''} onClick={() => setSelectedSignal(signalId)}><td><span className="signal-cell"><span className="signal-badge"><Activity size={13} /></span><b>{nameOf(signal)}</b></span></td><td>{assetName}</td><td className="value-cell">{last ? Number(last.value).toLocaleString() : '—'}</td><td>{signal.unit || '—'}</td><td><span className={`quality-chip ${last && Number(last.qualitycode ?? 192) >= 192 ? 'good' : last ? 'poor' : ''}`}><i />{last ? Number(last.qualitycode ?? 192) >= 192 ? 'Good' : `Code ${last.qualitycode}` : 'No data'}</span></td><td>{last ? formatTime(last.timestamp) : '—'}</td><td><button className="row-arrow" onClick={(event) => { event.stopPropagation(); setSelectedSignal(signalId); }} aria-label={`Select ${nameOf(signal)}`}><ChevronRight size={16} /></button></td></tr>;
          })}{filteredSignals.length === 0 && <tr><td className="empty-cell" colSpan={7}>{connected ? 'No signals found. Check that IIH Essentials has variables configured.' : 'Connect to IIH Essentials to load your process signals.'}</td></tr>}</tbody></table></div><div className="table-foot"><span>Showing {Math.min(filteredSignals.length, 60)} of {filteredSignals.length} signals</span><span>Refreshes when you select Update</span></div></article>
          <article className="panel assets-panel"><div className="panel-heading"><div><div className="section-kicker">EQUIPMENT</div><h2>Asset hierarchy</h2><p>{assets.length} assets available</p></div><button className="outline-icon" title="Refresh assets" onClick={() => void loadDashboard()}><RefreshCw size={14} /></button></div><div className="asset-list">{assets.slice(0, 9).map((asset) => {
            const assetId = idOf(asset); const count = signals.filter((signal) => (signal.assetId ?? signal.asset?.id ?? signal.parentId) === assetId).length;
            return <button className="asset-item" key={assetId} onClick={() => { const match = signals.find((signal) => (signal.assetId ?? signal.asset?.id ?? signal.parentId) === assetId); if (match) setSelectedSignal(idOf(match)); setSearch(nameOf(asset)); }}><span className="asset-icon"><Factory size={15} /></span><span className="asset-label"><b>{nameOf(asset)}</b><small>{asset.type ?? asset.assetType ?? 'Production asset'}</small></span><span className="asset-count">{count}<small>signals</small></span><ChevronRight size={15} className="asset-chevron" /></button>;
          })}{assets.length === 0 && <div className="assets-empty"><Layers3 size={20} /><b>No assets to display</b><span>Connect to an IIH Essentials instance to load the equipment hierarchy.</span></div>}</div><div className="asset-bottom"><span><CircleHelp size={13} /> Asset data is read from IIH Essentials</span><button onClick={() => void loadDashboard()}>Refresh list</button></div></article>
        </section>
        <footer className="dashboard-footer"><span>Performance Insight <b>·</b> Industrial Edge</span><span>{settings.baseUrl ? `Source: ${settings.baseUrl}` : 'Configure an IIH Essentials device to begin'}</span><button onClick={() => setShowSettings(true)}>Connection settings</button></footer>
      </main>

      {showSettings && <div className="modal-shade" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSettings(false); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-x" onClick={() => setShowSettings(false)} aria-label="Close"><X size={18} /></button><div className="section-kicker">DEVICE CONNECTION</div><h2 id="modal-title">Connect IIH Essentials</h2><p>Data is requested directly from your IIH Essentials API by this browser. No backend service is used.</p><label className="field-label" htmlFor="deviceUrl">IIH Essentials base URL</label><input id="deviceUrl" className="url-input" value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveAndConnect(); }} placeholder="https://192.168.1.10/iih-essentials" autoFocus /><span className="field-help">Examples: <code>https://&lt;device-ip&gt;/iih-essentials</code> or <code>http://localhost:4203</code></span><label className="credentials-toggle"><input type="checkbox" checked={draftCredentials} onChange={(event) => setDraftCredentials(event.target.checked)} /><span>Include browser session credentials</span></label><div className="auth-note"><AlertCircle size={15} /><span>Sign in to the Industrial Edge device in this browser. For a different page origin, the device must allow it through CORS. Browsers do not let frontend code set the IIH auth cookie directly.</span></div>{error && <div className="modal-error">{error}</div>}<div className="modal-actions"><button className="cancel-button" onClick={() => setShowSettings(false)}>Cancel</button><button className="blue-button" onClick={saveAndConnect} disabled={connection === 'connecting'}>{connection === 'connecting' ? <><LoaderCircle className="spin" size={15} /> Connecting</> : <>Save &amp; connect <ChevronRight size={15} /></>}</button></div><div className="privacy-note"><Check size={13} /> URL preferences are saved in this browser only.</div></section></div>}
    </div>
  );
}

function MetricCard({ label, value, unit, caption, icon, accent }: { label: string; value: string | number; unit: string; caption: string; icon: ReactNode; accent: string }) {
  return <article className="metric-card"><div className="metric-head"><span>{label}</span><span className={`metric-icon ${accent}`}>{icon}</span></div><div className="metric-reading"><strong>{value}</strong><span>{unit}</span></div><div className="metric-caption">{caption}</div><div className={`metric-line ${accent}`} /></article>;
}

function MiniChart({ values }: { values: number[] }) {
  if (!values.length) return <div className="chart-placeholder"><span>No time-series values for this range</span><div className="placeholder-grid" /></div>;
  const min = Math.min(...values); const max = Math.max(...values); const spread = max - min || Math.max(Math.abs(max) * .04, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${80 - ((value - min) / spread) * 62}`).join(' ');
  return <div className="mini-chart"><svg viewBox="0 0 100 90" preserveAspectRatio="none" role="img" aria-label="Signal trend chart"><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5688ff" stopOpacity=".18" /><stop offset="100%" stopColor="#5688ff" stopOpacity="0" /></linearGradient></defs><polygon points={`0,90 ${points} 100,90`} fill="url(#trendFill)" /><polyline points={points} fill="none" stroke="#507cf4" strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg></div>;
}

export default App;
