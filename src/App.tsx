import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Braces, Check, ChevronDown,
  ChevronRight, CircleHelp, Clock3, Factory, Gauge, Layers3, LoaderCircle, RefreshCw,
  Search, Settings2, SlidersHorizontal, Wifi, X, Play,
} from 'lucide-react';
import apiCatalogData from './data/iih-essentials-2.7.json';

type AnyRecord = Record<string, any>;
type Point = { timestamp: string; value: number | string; qualitycode?: number };
type Asset = AnyRecord;
type Signal = AnyRecord;
type ApiSettings = { baseUrl: string; credentials: boolean };
type ApiParameter = { name: string; in: string; required: boolean; description?: string; example?: unknown; default?: unknown; type?: string; format?: string; enum?: string[] };
type ApiEndpoint = { path: string; method: string; tags: string[]; summary: string; description?: string; deprecated?: boolean; parameters: ApiParameter[]; requestBody?: { required: boolean; contentType?: string; example?: unknown; schema?: AnyRecord }; responses: { status: string; description?: string }[] };
type ApiCatalog = { info: { title: string; version: string }; endpointCount: number; tags: { name: string; description?: string }[]; endpoints: ApiEndpoint[] };

const DEFAULT_API_BASE = 'http://edgeappdataservice:4203';
const savedApiBase = localStorage.getItem('iihBase');
const apiCatalog = apiCatalogData as ApiCatalog;
const supportedApiEndpoints = apiCatalog.endpoints.filter((endpoint) => !endpoint.deprecated);

const storedSettings: ApiSettings = {
  baseUrl: savedApiBase && savedApiBase !== 'http://localhost:4203' ? savedApiBase : DEFAULT_API_BASE,
  credentials: localStorage.getItem('iihCredentials') !== 'false',
};
const unwrap = (value: any): any[] => Array.isArray(value) ? value :
  Array.isArray(value?.data) ? value.data : Array.isArray(value?.items) ? value.items :
    Array.isArray(value?.assets) ? value.assets : Array.isArray(value?.variables) ? value.variables : [];
const idOf = (value?: AnyRecord) => value?.id ?? value?.anchor ?? value?.['$anchor'] ?? value?.variableId ?? value?.assetId ?? '';
const nameOf = (value?: AnyRecord) => value?.name ?? value?.displayName ?? value?.label ?? dictionaryValue(value?.['$displayname']) ?? value?.['$name'] ?? value?.['$anchor'] ?? 'Unnamed';
function dictionaryValue(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return Object.values(value as AnyRecord)[0];
  return undefined;
}
const formatTime = (raw?: string) => raw ? new Date(raw).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const resolveApiUrl = (baseUrl: string, path: string) => baseUrl.replace(/\/+$/, '') === DEFAULT_API_BASE ? `/iih-api${path}` : `${baseUrl.replace(/\/+$/, '')}${path}`;

async function apiGet<T>(baseUrl: string, path: string, credentials: boolean): Promise<T> {
  let response: Response;
  try {
    const target = resolveApiUrl(baseUrl, path);
    response = await fetch(target, {
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

function ApiExplorer({ settings }: { settings: ApiSettings }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState('');
  const groups = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const matches = supportedApiEndpoints.filter((endpoint) => !needle || `${endpoint.path} ${endpoint.method} ${endpoint.summary} ${endpoint.tags.join(' ')}`.toLowerCase().includes(needle));
    const grouped = new Map<string, ApiEndpoint[]>();
    for (const endpoint of matches) {
      const tag = endpoint.tags[0] ?? 'Other';
      grouped.set(tag, [...(grouped.get(tag) ?? []), endpoint]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [search]);
  const visibleCount = groups.reduce((count, [, endpoints]) => count + endpoints.length, 0);

  return <main className="api-page">
    <div className="api-page-head"><div><div className="section-kicker">IIH ESSENTIALS REST API</div><h1>API Explorer</h1><p>Browse supported operations in the Siemens {apiCatalog.info.version} specification. Deprecated operations are hidden. Open a GET operation to call IIH Essentials and inspect its live response.</p></div><div className="api-version">OpenAPI <b>{apiCatalog.info.version}</b></div></div>
    <div className="api-upstream"><span className="upstream-led" /><div><b>Live API target</b><code>{settings.baseUrl || DEFAULT_API_BASE}</code></div><span className="proxy-note">Device network via same-origin route</span></div>
    <div className="api-toolbar"><label className="search-box api-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search paths, operations, or groups" /></label><span>{visibleCount} of {supportedApiEndpoints.length} operations</span></div>
    <div className="api-groups">{groups.map(([tag, endpoints]) => <section className="api-group" key={tag}><header><div><h2>{tag}</h2><p>{apiCatalog.tags.find((item) => item.name === tag)?.description || `${endpoints.length} documented operation${endpoints.length === 1 ? '' : 's'}`}</p></div><span>{endpoints.length}</span></header><div className="api-operation-list">{endpoints.map((endpoint, index) => {
      const operationKey = `${tag}:${endpoint.method}:${endpoint.path}:${index}`;
      const isOpen = expanded === operationKey;
      return <article className={`api-operation ${isOpen ? 'open' : ''}`} key={operationKey}><button className="operation-toggle" onClick={() => setExpanded(isOpen ? '' : operationKey)} aria-expanded={isOpen}><span className={`method-badge method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><code>{endpoint.path}</code><span className="operation-summary">{endpoint.summary}</span>{endpoint.deprecated && <span className="deprecated-badge">Deprecated</span>}<ChevronDown size={15} className="operation-chevron" /></button>{isOpen && <ApiOperationPanel endpoint={endpoint} settings={settings} />}</article>;
    })}</div></section>)}{groups.length === 0 && <div className="api-no-results">No API operations match “{search}”.</div>}</div>
    <footer className="api-footer">API catalog source: <a href="https://developer.siemens.com/industrial-information-hub/api/iih-essentials/v2.7/iih-essentials-2.7.0.html" target="_blank" rel="noreferrer">Siemens IIH Essentials API {apiCatalog.info.version}</a><span>GET calls run when opened. Other HTTP methods require an explicit run action.</span></footer>
  </main>;
}

function ApiOperationPanel({ endpoint, settings }: { endpoint: ApiEndpoint; settings: ApiSettings }) {
  const [parameters, setParameters] = useState<Record<string, string>>(() => Object.fromEntries(endpoint.parameters.map((parameter) => [parameter.name, displayParameterValue(parameter.example ?? parameter.default)])));
  const [body, setBody] = useState(() => endpoint.requestBody?.example && typeof endpoint.requestBody.example === 'object' && '$ref' in (endpoint.requestBody.example as AnyRecord) ? '{}' : endpoint.requestBody?.example ? JSON.stringify(endpoint.requestBody.example, null, 2) : '{}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState('');
  const [statusCode, setStatusCode] = useState<number>();
  const [requestUrl, setRequestUrl] = useState('');
  const autoRequested = useRef(false);

  const requiredMissing = endpoint.parameters.filter((parameter) => parameter.required && !parameters[parameter.name]?.trim());
  const sideEffectingGet = endpoint.method === 'GET' && /delete|reset|create|discover|abort|write|trigger|start|stop|execute|cancel|release|attach/i.test(`${endpoint.path} ${endpoint.summary}`);
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(endpoint.method) || sideEffectingGet;
  const autoReadable = ['GET', 'HEAD', 'OPTIONS'].includes(endpoint.method) && !sideEffectingGet;

  async function execute(manual = false) {
    if (mutating && !manual) return;
    if (requiredMissing.length) { setError(`Provide required ${requiredMissing.map((parameter) => `${parameter.in} parameter “${parameter.name}”`).join(', ')} to run this operation.`); return; }
    if ((endpoint.method === 'DELETE' || sideEffectingGet) && !window.confirm(`Run ${endpoint.method} ${endpoint.path}? This may change IIH Essentials data.`)) return;
    let path = endpoint.path;
    const headers: Record<string, string> = { Accept: 'application/json' };
    for (const parameter of endpoint.parameters) {
      const value = parameters[parameter.name]?.trim();
      if (!value) continue;
      if (parameter.in === 'path') path = path.replace(`{${parameter.name}}`, encodeURIComponent(value));
      if (parameter.in === 'header' && parameter.name.toLowerCase() !== 'cookie') headers[parameter.name] = value;
    }
    const query = new URLSearchParams();
    for (const parameter of endpoint.parameters) {
      const value = parameters[parameter.name]?.trim();
      if (parameter.in === 'query' && value) query.set(parameter.name, value);
    }
    if (query.toString()) path += `?${query.toString()}`;
    const target = resolveApiUrl(settings.baseUrl, path);
    setRequestUrl(target); setLoading(true); setError(''); setResult(undefined); setStatusCode(undefined);
    try {
      if (endpoint.requestBody && !['GET', 'HEAD'].includes(endpoint.method)) headers['Content-Type'] = endpoint.requestBody.contentType ?? 'application/json';
      const response = await fetch(target, {
        method: endpoint.method,
        credentials: settings.credentials ? 'include' : 'omit',
        headers,
        body: endpoint.requestBody && !['GET', 'HEAD'].includes(endpoint.method) ? body : undefined,
      });
      const raw = await response.text();
      let data: unknown;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
      setStatusCode(response.status); setResult(data);
      if (!response.ok) setError(`HTTP ${response.status} ${response.statusText}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Request failed. Check that the Industrial Edge proxy can reach IIH Essentials.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!autoRequested.current && autoReadable && !requiredMissing.length) {
      autoRequested.current = true; void execute(false);
    }
    // Run once when the accordion is opened; changing a parameter is explicit via Run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="operation-detail"><p className="operation-description">{endpoint.description || endpoint.summary}</p><div className="operation-meta"><code>{requestUrl || `${settings.baseUrl}${endpoint.path}`}</code><span>{endpoint.deprecated ? 'Deprecated in this API version' : 'IIH Essentials 2.7.0'}</span></div>
    {endpoint.parameters.length > 0 && <div className="parameter-section"><h4>Parameters</h4><div className="parameter-grid">{endpoint.parameters.map((parameter) => <label key={`${parameter.in}-${parameter.name}`} className="parameter-field"><span>{parameter.name}<small>{parameter.in}{parameter.required ? ' · required' : ''}</small></span><input value={parameters[parameter.name] ?? ''} onChange={(event) => setParameters((current) => ({ ...current, [parameter.name]: event.target.value }))} placeholder={parameter.example === undefined ? parameter.description || 'Optional' : `Example: ${displayParameterValue(parameter.example)}`} />{parameter.description && <em>{parameter.description}</em>}</label>)}</div></div>}
    {endpoint.requestBody && <label className="body-field"><span>Request body <small>{endpoint.requestBody.contentType}{endpoint.requestBody.required ? ' · required' : ''}</small></span><textarea value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} /></label>}
    <div className="operation-actions">{mutating && <span className="mutation-hint"><AlertCircle size={13} /> This operation can change data and requires a deliberate run.</span>}<button className="run-operation" onClick={() => void execute(true)} disabled={loading || requiredMissing.length > 0}><Play size={13} />{loading ? 'Requesting…' : `Run ${endpoint.method}`}</button></div>
    {requiredMissing.length > 0 && <div className="required-hint">Fill required parameters to run this request.</div>}
    {loading && <div className="api-loading"><LoaderCircle className="spin" size={15} /> Calling IIH Essentials…</div>}
    {error && <div className="api-response-error"><AlertCircle size={14} />{error}</div>}
    {result !== undefined && <div className="api-result"><div className="result-head"><h4>Response</h4><span className={`response-status ${statusCode && statusCode < 400 ? 'success' : 'failure'}`}>{statusCode}</span></div><pre>{formatJson(result)}</pre></div>}
    <div className="documented-responses"><b>Documented responses</b>{endpoint.responses.slice(0, 5).map((response) => <span key={response.status}><code>{response.status}</code> {response.description}</span>)}</div>
  </div>;
}

function displayParameterValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function formatJson(value: unknown): string {
  let output: string;
  if (typeof value === 'string') output = value;
  else { try { output = JSON.stringify(value, null, 2) ?? 'null'; } catch { output = String(value); } }
  return output.length > 50000 ? `${output.slice(0, 50000)}\n\n… response preview truncated at 50,000 characters …` : output;
}

function App() {
  const [settings, setSettings] = useState<ApiSettings>(storedSettings);
  const [draftUrl, setDraftUrl] = useState(storedSettings.baseUrl);
  const [draftCredentials, setDraftCredentials] = useState(storedSettings.credentials);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<'dashboard' | 'api' | 'operator'>(() => window.location.pathname.startsWith('/api') ? 'api' : window.location.pathname.startsWith('/operator') ? 'operator' : 'dashboard');
  const [connection, setConnection] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [series, setSeries] = useState<Record<string, Point[]>>({});
  const [selectedSignal, setSelectedSignal] = useState('');
  const [rangeHours, setRangeHours] = useState(24);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const onPopState = () => setView(window.location.pathname.startsWith('/api') ? 'api' : window.location.pathname.startsWith('/operator') ? 'operator' : 'dashboard');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
      const signalResult = await apiGet<unknown>(nextSettings.baseUrl, '/DataService/anchor-ex/v1/attributes?take=1000&_includeSource=true&_includePath=true', nextSettings.credentials);
      const nextAssets = unwrap(assetResult) as Asset[];
      const nextSignals = (unwrap(signalResult) as Signal[])
        .filter((signal) => signal.$_source != null)
        .map((signal) => ({
          ...signal,
          id: idOf(signal),
          variableId: idOf(signal),
          name: nameOf(signal),
          unit: signal.unit ?? signal.$unit,
          assetId: signal.$_owner ?? signal.assetId,
          assetName: signal.$_path?.name ?? signal.$_path?.displayName,
        }));
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
    const params = new URLSearchParams({ variableIds: ids.join(','), from: from.toISOString(), to: to.toISOString(), limit: '100' });
    try {
      const result = await apiGet<unknown>(nextSettings.baseUrl, `/DataService/Data?${params}`, nextSettings.credentials);
      const next: Record<string, Point[]> = {};
      for (const item of unwrap(result)) next[item.variableId ?? item.id] = item.values ?? [];
      setSeries(next); setLastUpdated(new Date());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to read signal values.');
    }
  }

  useEffect(() => {
    const signalIds = signals.map(idOf).filter(Boolean).slice(0, 100);
    if (!signalIds.length || !settings.baseUrl) return;

    let stopped = false;
    let timer: number | undefined;
    const refreshSignalData = async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 10 * 1000);
      const params = new URLSearchParams({
        variableIds: signalIds.join(','),
        from: from.toISOString(),
        to: to.toISOString(),
        limit: '100',
      });

      try {
        const result = await apiGet<unknown>(settings.baseUrl, `/DataService/Data?${params}`, settings.credentials);
        const updates = unwrap(result) as AnyRecord[];
        if (!stopped) {
          setSeries((current) => {
            const next = { ...current };
            for (const item of updates) {
              const id = item.variableId ?? item.id;
              if (!id) continue;
              const byPoint = new Map<string, Point>();
              for (const point of [...(current[id] ?? []), ...(item.values ?? [])] as Point[]) {
                const key = `${point.timestamp ?? ''}:${point.value}:${point.qualitycode ?? ''}`;
                byPoint.set(key, point);
              }
              next[id] = [...byPoint.values()]
                .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
                .slice(-2000);
            }
            return next;
          });
          setLastUpdated(new Date());
          setError('');
        }
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error ? reason.message : 'Unable to refresh signal data.');
      }

      if (!stopped) timer = window.setTimeout(() => void refreshSignalData(), 1000);
    };

    timer = window.setTimeout(() => void refreshSignalData(), 1000);
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [signals, settings.baseUrl, settings.credentials]);

  useEffect(() => { if (settings.baseUrl) void loadDashboard(); /* restore saved device on first render */ // eslint-disable-line react-hooks/exhaustive-deps
  }, []);

  function saveAndConnect() {
    const trimmed = draftUrl.trim().replace(/\/+$/, '');
    try { new URL(trimmed); } catch { setError('Enter a full URL such as https://192.168.1.10/iih-essentials.'); return; }
    const next = { baseUrl: trimmed, credentials: draftCredentials };
    localStorage.setItem('iihBase', next.baseUrl); localStorage.setItem('iihCredentials', String(next.credentials));
    setSettings(next); setShowSettings(false); setSelectedSignal(''); void loadDashboard(next);
  }

  function navigate(nextView: 'dashboard' | 'api' | 'operator') {
    window.history.pushState({}, '', nextView === 'api' ? '/api' : nextView === 'operator' ? '/operator' : '/');
    setView(nextView);
  }

  const connected = connection === 'connected';
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="product"><span className="product-symbol"><Activity size={17} /></span><span>Performance Insight <em>Operator Dashboard</em></span></div>
        <nav className="page-nav"><button className={view === 'dashboard' ? 'selected' : ''} onClick={() => navigate('dashboard')}>Overview</button><button className={view === 'operator' ? 'selected' : ''} onClick={() => navigate('operator')}><Gauge size={14} /> Operator Dashboard</button><button className={view === 'api' ? 'selected' : ''} onClick={() => navigate('api')}><Braces size={14} /> API Explorer</button></nav>
        <div className="topbar-right"><span className={`connection-pill ${connected ? 'is-online' : ''}`}><i />{connected ? 'CONNECTED' : connection === 'connecting' ? 'CONNECTING' : 'NOT CONNECTED'}</span><span className="clock-label"><Clock3 size={14} />{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live operations'}</span><button className="top-icon" title="Connection settings" onClick={() => setShowSettings(true)}><Settings2 size={18} /></button></div>
      </header>

      {view === 'api' ? <ApiExplorer settings={settings} /> : view === 'operator' ? <OperatorDashboard settings={settings} /> : <main className="dashboard">
        <section className="status-strip">
          <div className="status-cell"><span className="status-label">DEVICE</span><span className="status-value"><span className={`device-led ${connected ? 'online' : ''}`} />{settings.baseUrl ? settings.baseUrl.replace(/^https?:\/\//, '') : 'IIH Essentials not configured'}</span></div>
          <span className="strip-divider" />
          <div className="status-cell"><span className="status-label">ASSETS</span><span className="status-value">{assets.length || '—'}</span></div>
          <span className="strip-divider" />
          <div className="status-cell"><span className="status-label">SIGNALS</span><span className="status-value">{signals.length || '—'}</span></div>
          <span className="strip-divider" />
          <div className="status-cell"><span className="status-label">AUTO REFRESH</span><span className="status-value">Every second</span></div>
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
          })}{filteredSignals.length === 0 && <tr><td className="empty-cell" colSpan={7}>{connected ? 'No signals found. Check that IIH Essentials has variables configured.' : 'Connect to IIH Essentials to load your process signals.'}</td></tr>}</tbody></table></div><div className="table-foot"><span>Showing {Math.min(filteredSignals.length, 60)} of {filteredSignals.length} signals</span><span>Loaded signals refresh every second</span></div></article>
          <article className="panel assets-panel"><div className="panel-heading"><div><div className="section-kicker">EQUIPMENT</div><h2>Asset hierarchy</h2><p>{assets.length} assets available</p></div><button className="outline-icon" title="Refresh assets" onClick={() => void loadDashboard()}><RefreshCw size={14} /></button></div><div className="asset-list">{assets.slice(0, 9).map((asset) => {
            const assetId = idOf(asset); const count = signals.filter((signal) => (signal.assetId ?? signal.asset?.id ?? signal.parentId) === assetId).length;
            return <button className="asset-item" key={assetId} onClick={() => { const match = signals.find((signal) => (signal.assetId ?? signal.asset?.id ?? signal.parentId) === assetId); if (match) setSelectedSignal(idOf(match)); setSearch(nameOf(asset)); }}><span className="asset-icon"><Factory size={15} /></span><span className="asset-label"><b>{nameOf(asset)}</b><small>{asset.type ?? asset.assetType ?? 'Production asset'}</small></span><span className="asset-count">{count}<small>signals</small></span><ChevronRight size={15} className="asset-chevron" /></button>;
          })}{assets.length === 0 && <div className="assets-empty"><Layers3 size={20} /><b>No assets to display</b><span>Connect to an IIH Essentials instance to load the equipment hierarchy.</span></div>}</div><div className="asset-bottom"><span><CircleHelp size={13} /> Asset data is read from IIH Essentials</span><button onClick={() => void loadDashboard()}>Refresh list</button></div></article>
        </section>
        <footer className="dashboard-footer"><span>Performance Insight <b>·</b> Industrial Edge</span><span>{settings.baseUrl ? `Source: ${settings.baseUrl}` : 'Configure an IIH Essentials device to begin'}</span><button onClick={() => setShowSettings(true)}>Connection settings</button></footer>
      </main>}

      {showSettings && <div className="modal-shade" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSettings(false); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-x" onClick={() => setShowSettings(false)} aria-label="Close"><X size={18} /></button><div className="section-kicker">DEVICE CONNECTION</div><h2 id="modal-title">Connect IIH Essentials</h2><p>The deployed app defaults to the IIH Essentials service inside the Industrial Edge Docker network.</p><label className="field-label" htmlFor="deviceUrl">IIH Essentials base URL</label><input id="deviceUrl" className="url-input" value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveAndConnect(); }} placeholder="http://edgeappdataservice:4203" autoFocus /><span className="field-help">Default deployed URL: <code>http://edgeappdataservice:4203</code>. Development kit: <code>http://localhost:4203</code></span><label className="credentials-toggle"><input type="checkbox" checked={draftCredentials} onChange={(event) => setDraftCredentials(event.target.checked)} /><span>Include browser session credentials</span></label><div className="auth-note"><AlertCircle size={15} /><span>Sign in to the Industrial Edge device in this browser. The same-origin route forwards its IIH auth cookie to the service. Custom external URLs may need CORS access.</span></div>{error && <div className="modal-error">{error}</div>}<div className="modal-actions"><button className="cancel-button" onClick={() => setShowSettings(false)}>Cancel</button><button className="blue-button" onClick={saveAndConnect} disabled={connection === 'connecting'}>{connection === 'connecting' ? <><LoaderCircle className="spin" size={15} /> Connecting</> : <>Save &amp; connect <ChevronRight size={15} /></>}</button></div><div className="privacy-note"><Check size={13} /> URL preferences are saved in this browser only.</div></section></div>}
    </div>
  );
}

function MetricCard({ label, value, unit, caption, icon, accent }: { label: string; value: string | number; unit: string; caption: string; icon: ReactNode; accent: string }) {
  return <article className="metric-card"><div className="metric-head"><span>{label}</span><span className={`metric-icon ${accent}`}>{icon}</span></div><div className="metric-reading"><strong>{value}</strong><span>{unit}</span></div><div className="metric-caption">{caption}</div><div className={`metric-line ${accent}`} /></article>;
}

const OPERATOR_BATCH_ID = 'aa72e1b1-bf4a-473c-981f-d3176248d575';
type BatchEvent = { value: string; timestamp: string; label: string };
type OperatorSignal = { id: string; name: string; unit: string };

async function readOperatorHistory(settings: ApiSettings, variableId: string, from = 'null', to = 'null'): Promise<Point[]> {
  const points: Point[] = [];
  let pageFrom = from;
  const seenPages = new Set<string>();
  while (!seenPages.has(pageFrom)) {
    seenPages.add(pageFrom);
    const params = new URLSearchParams({ variableIds: variableId, from: pageFrom, to, limit: '2000', order: 'Ascending' });
    const result = await apiGet<AnyRecord>(settings.baseUrl, `/DataService/Data?${params}`, settings.credentials);
    const items = unwrap(result) as AnyRecord[];
    const item = items.find((entry) => (entry.variableId ?? entry.id) === variableId) ?? items[0];
    points.push(...((item?.values ?? []) as Point[]));
    const nextFrom = result?.hasMoreData?.from;
    if (!nextFrom || seenPages.has(nextFrom)) break;
    pageFrom = nextFrom;
  }
  return points.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function toBatchEvents(points: Point[]): BatchEvent[] {
  const events: BatchEvent[] = [];
  let previous = '';
  for (const point of points) {
    const value = String(point.value ?? '').trim();
    if (!value || value === previous) continue;
    previous = value;
    const label = /^\d+$/.test(value) ? `Batch ${value}` : value;
    events.push({ value, timestamp: point.timestamp, label });
  }
  return events;
}

function averagePoints(points: Point[]) {
  const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function OperatorDashboard({ settings }: { settings: ApiSettings }) {
  const [batchHistory, setBatchHistory] = useState<BatchEvent[]>([]);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(-1);
  const [rpmSignal, setRpmSignal] = useState<OperatorSignal | null>(null);
  const [temperatureSignal, setTemperatureSignal] = useState<OperatorSignal | null>(null);
  const [liveReadings, setLiveReadings] = useState<Record<string, number>>({});
  const [previousAverages, setPreviousAverages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    Promise.all([
      readOperatorHistory(settings, OPERATOR_BATCH_ID),
      apiGet<unknown>(settings.baseUrl, '/DataService/anchor-ex/v1/attributes?take=1000&_includeSource=true&_includePath=true', settings.credentials),
    ]).then(([history, attributeResult]) => {
      if (stopped) return;
      const events = toBatchEvents(history);
      const attributes = unwrap(attributeResult) as AnyRecord[];
      const rpm = attributes.find((item) => /rpm|revolutions per minute|rotational speed/i.test(nameOf(item)));
      const temperature = attributes.find((item) => /temp|temperature/i.test(nameOf(item)));
      const signalFrom = (item?: AnyRecord): OperatorSignal | null => item && idOf(item) ? { id: idOf(item), name: nameOf(item), unit: item.unit ?? item.$unit ?? '' } : null;
      setBatchHistory(events);
      setSelectedBatchIndex((selected) => selected >= 0 && selected < events.length ? selected : events.length - 1);
      setRpmSignal(signalFrom(rpm));
      setTemperatureSignal(signalFrom(temperature));
      if (!events.length) setError('No batch history was returned for the configured batch data attribute. Confirm that this ID is an IIH time-series variable.');
    }).catch((reason) => {
      if (!stopped) setError(reason instanceof Error ? reason.message : 'Could not load batch data from IIH Essentials.');
    }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [settings.baseUrl, settings.credentials]);

  useEffect(() => {
    const selected = batchHistory[selectedBatchIndex];
    const previous = batchHistory[selectedBatchIndex - 1];
    if (!selected || !previous || !rpmSignal && !temperatureSignal) { setPreviousAverages({}); return; }
    let stopped = false;
    Promise.all([rpmSignal, temperatureSignal].filter((signal): signal is OperatorSignal => Boolean(signal)).map((signal) => readOperatorHistory(settings, signal.id, previous.timestamp, selected.timestamp)))
      .then((results) => { if (!stopped) { const next: Record<string, number> = {}; [rpmSignal, temperatureSignal].filter((signal): signal is OperatorSignal => Boolean(signal)).forEach((signal, index) => { const average = averagePoints(results[index] ?? []); if (average !== undefined) next[signal.id] = average; }); setPreviousAverages(next); } })
      .catch((reason) => { if (!stopped) setError(reason instanceof Error ? reason.message : 'Could not load the selected batch history.'); });
    return () => { stopped = true; };
  }, [batchHistory, selectedBatchIndex, rpmSignal, temperatureSignal, settings.baseUrl, settings.credentials]);

  useEffect(() => {
    const signals = [rpmSignal, temperatureSignal].filter((signal): signal is OperatorSignal => Boolean(signal));
    if (!signals.length) return;
    let stopped = false;
    let timer: number;
    const refresh = async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 10_000);
      try {
        const results = await Promise.all(signals.map((signal) => readOperatorHistory(settings, signal.id, from.toISOString(), to.toISOString())));
        if (!stopped) { const next: Record<string, number> = {}; signals.forEach((signal, index) => { const latest = results[index]?.at(-1); const value = Number(latest?.value); if (Number.isFinite(value)) next[signal.id] = value; }); setLiveReadings(next); }
      } catch (reason) { if (!stopped) setError(reason instanceof Error ? reason.message : 'Unable to refresh RPM and temperature.'); }
      if (!stopped) timer = window.setTimeout(() => void refresh(), 1000);
    };
    timer = window.setTimeout(() => void refresh(), 1000);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [rpmSignal, temperatureSignal, settings.baseUrl, settings.credentials]);

  const currentEvent = batchHistory.at(-1);
  const lastBatch = batchHistory[selectedBatchIndex - 1];
  const liveValue = (signal: OperatorSignal | null) => signal ? liveReadings[signal.id] : undefined;
  const formatMetric = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return <main className="operator-page">
    <div className="operator-current-strip"><div><span>Current batch</span><b>{currentEvent?.label ?? (loading ? 'Loading…' : '—')}</b></div><span>Mode: <b>AUTO</b></span><span>Batch started: <b>{currentEvent ? formatTime(currentEvent.timestamp) : '—'}</b></span><b className="operator-step">Live RPM and temperature refresh every second</b><span className="prediction-ready">{currentEvent ? 'BATCH DATA READY' : 'WAITING FOR DATA'}</span></div>
    {error && <div className="error-banner"><AlertCircle size={16} /><span>{error}</span></div>}
    <section className="operator-review-grid">
      <article className="operator-review-card"><div className="operator-review-heading"><div><b>Current shift in review</b><span>Live process readings</span></div><span className="operator-batch-badge">{currentEvent?.label ?? 'Current batch'}</span></div><div className="operator-live-metrics"><div><span>{rpmSignal?.name ?? 'RPM'}</span><strong>{formatMetric(liveValue(rpmSignal))}</strong><small>{rpmSignal?.unit || 'rpm'} · live</small></div><div><span>{temperatureSignal?.name ?? 'Temperature'}</span><strong>{formatMetric(liveValue(temperatureSignal))}</strong><small>{temperatureSignal?.unit || '°C'} · live</small></div></div></article>
      <article className="operator-review-card"><div className="operator-review-heading"><div><b>Last batch in review</b><span>{lastBatch ? `${lastBatch.label} · ${formatTime(lastBatch.timestamp)}` : 'Average RPM and temperature'}</span></div><label className="operator-batch-select"><select aria-label="Choose a batch to review its predecessor" value={selectedBatchIndex} onChange={(event) => setSelectedBatchIndex(Number(event.target.value))} disabled={batchHistory.length < 2}><option value={-1}>Select batch</option>{batchHistory.map((event, index) => <option key={`${event.timestamp}-${index}`} value={index}>{event.label}</option>)}</select><ChevronDown size={13} /></label></div><div className="operator-live-metrics"><div><span>Average RPM</span><strong>{rpmSignal ? formatMetric(previousAverages[rpmSignal.id]) : '—'}</strong><small>{rpmSignal?.unit || 'rpm'} · {lastBatch ? lastBatch.label : 'previous batch'}</small></div><div><span>Average temperature</span><strong>{temperatureSignal ? formatMetric(previousAverages[temperatureSignal.id]) : '—'}</strong><small>{temperatureSignal?.unit || '°C'} · {lastBatch ? lastBatch.label : 'previous batch'}</small></div></div><div className="operator-batch-select-help">Select a batch to review the batch immediately before it.</div></article>
    </section>
    <section className="operator-quality-grid"><article className="operator-quality-card"><div className="operator-review-heading"><b>Viscosity</b><span className="operator-batch-badge">Previous batch {lastBatch?.label ?? '—'}</span></div><div className="operator-quality-values"><div><span>Predicted</span><strong className="predicted-value">—</strong><small>cPs (MAE, last 100)</small></div><div><span>Actual (lab)</span><strong>—</strong><small>Operator entered</small></div><div><span>Spec (LSL - USL)</span><strong className="spec-value">Awaiting IDs</strong><small>cPs</small></div></div><div className="operator-quality-placeholder">Provide the viscosity signal and specification IDs to display batch predictions and lab results.</div></article><article className="operator-quality-card"><div className="operator-review-heading"><b>pH</b><span className="operator-batch-badge">Previous batch {lastBatch?.label ?? '—'}</span></div><div className="operator-quality-values"><div><span>Predicted</span><strong className="predicted-value">—</strong><small>MAE, last 100</small></div><div><span>Actual (lab)</span><strong>—</strong><small>Operator entered</small></div><div><span>Spec (LSL - USL)</span><strong className="spec-value">Awaiting IDs</strong><small>pH</small></div></div><div className="operator-quality-placeholder">Provide the pH signal and specification IDs to display batch predictions and lab results.</div></article></section>
    <footer className="operator-note">Batch history comes from the configured IIH time-series attribute. Selecting a batch shows RPM and temperature averages from the preceding batch interval.</footer>
  </main>;
}

function MiniChart({ values }: { values: number[] }) {
  if (!values.length) return <div className="chart-placeholder"><span>No time-series values for this range</span><div className="placeholder-grid" /></div>;
  const min = Math.min(...values); const max = Math.max(...values); const spread = max - min || Math.max(Math.abs(max) * .04, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${80 - ((value - min) / spread) * 62}`).join(' ');
  return <div className="mini-chart"><svg viewBox="0 0 100 90" preserveAspectRatio="none" role="img" aria-label="Signal trend chart"><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5688ff" stopOpacity=".18" /><stop offset="100%" stopColor="#5688ff" stopOpacity="0" /></linearGradient></defs><polygon points={`0,90 ${points} 100,90`} fill="url(#trendFill)" /><polyline points={points} fill="none" stroke="#507cf4" strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg></div>;
}

export default App;
