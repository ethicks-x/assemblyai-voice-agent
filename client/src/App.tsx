import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { JobsAndInventory, WorkOrder, InventoryPart } from './components/JobsAndInventory';
import { VoiceConsole, TranscriptEntry } from './components/VoiceConsole';
import { InvoiceViewer, InvoiceData } from './components/InvoiceViewer';
import { ToolTimeline, ToolLogEntry } from './components/ToolTimeline';
import { FleetROI } from './components/FleetROI';
import { CustomerCheckoutModal } from './components/CustomerCheckoutModal';
import { ERPIntegrationsModal, ERPSyncData } from './components/ERPIntegrationsModal';
import { AuditTrailPanel, AuditEntry } from './components/AuditTrailPanel';
import { CatalogManagerModal, CatalogItem, BusinessProfile } from './components/CatalogManagerModal';
import { TaxSettingsModal } from './components/TaxSettingsModal';
import { soundEngine } from './utils/earcons';
import { FileText, Cpu, TrendingUp, ShieldCheck } from 'lucide-react';

export default function App() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryPart[]>([]);
  const [activeWorkOrderId, setActiveWorkOrderId] = useState<string>('WO-1042');

  // Business Profiles & Shop Catalog State
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<BusinessProfile | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<'INDIA' | 'GLOBAL'>('INDIA');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isTaxSettingsOpen, setIsTaxSettingsOpen] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [sessionMode, setSessionMode] = useState('STANDBY');

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [toolLogs, setToolLogs] = useState<ToolLogEntry[]>([]);
  const [generatedInvoice, setGeneratedInvoice] = useState<InvoiceData | null>(null);
  const [notificationSent, setNotificationSent] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isInvoicePaid, setIsInvoicePaid] = useState(false);
  const [erpSyncData, setErpSyncData] = useState<ERPSyncData | null>(null);
  const [isERPOpen, setIsERPOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  // Audio Telemetry & Polish
  const [latencyMs, setLatencyMs] = useState(380);
  const [packetsCount, setPacketsCount] = useState(0);
  const [isNoiseActive, setIsNoiseActive] = useState(false);
  const [isSoundFxEnabled, setIsSoundFxEnabled] = useState(true);

  const [rightTab, setRightTab] = useState<'invoice' | 'tools' | 'roi' | 'audit'>('invoice');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingAudioRef = useRef(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [woRes, invRes, profRes, catRes] = await Promise.all([
        fetch('/api/work-orders'),
        fetch('/api/inventory'),
        fetch('/api/business-profiles'),
        fetch('/api/catalog'),
      ]);
      const wos = await woRes.json();
      const invs = await invRes.json();
      const profData = await profRes.json();
      const catData = await catRes.json();

      setWorkOrders(wos);
      setInventory(invs);
      if (profData.profiles) {
        setProfiles(profData.profiles);
        setActiveProfile(profData.activeProfile);
        if (profData.activeProfile?.region === 'GLOBAL' || profData.activeProfile?.taxSystem !== 'GST_INDIA') {
          setSelectedRegion('GLOBAL');
        } else {
          setSelectedRegion('INDIA');
        }
      }
      if (Array.isArray(catData)) {
        setCatalog(catData);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup WebSocket to backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/client`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Client WS] Connected to backend gateway.');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'SESSION_STATE':
            setSessionMode(msg.data.mode || 'ACTIVE');
            if (msg.data.status === 'COMPLETED') {
              setIsSimulating(false);
              setIsListening(false);
            }
            break;

          case 'TRANSCRIPT':
            setTranscript((prev) => [
              ...prev,
              {
                speaker: msg.data.speaker,
                text: msg.data.text,
                isFinal: msg.data.isFinal,
                source: msg.data.source || 'browser',
                timestamp: Date.now(),
              },
            ]);
            break;

          case 'TOOL_START':
            setRightTab('tools');
            setToolLogs((prev) => [
              {
                id: `tool-${Date.now()}-${Math.random()}`,
                name: msg.data.name,
                status: 'RUNNING',
                args: msg.data.args,
                timestamp: Date.now(),
              },
              ...prev,
            ]);
            break;

          case 'TOOL_COMPLETE':
            soundEngine.playToolSuccessChime();
            setToolLogs((prev) =>
              prev.map((log) =>
                log.name === msg.data.name && log.status === 'RUNNING'
                  ? { ...log, status: 'COMPLETED', result: msg.data.result }
                  : log
              )
            );
            fetchData(); // refresh inventory stock and job status
            if (msg.data.name === 'send_customer_notification') {
              setNotificationSent(true);
            }
            break;

          case 'PROFILE_SWITCHED':
            setActiveProfile(msg.data);
            if (msg.data?.region === 'GLOBAL' || msg.data?.taxSystem !== 'GST_INDIA') {
              setSelectedRegion('GLOBAL');
            } else {
              setSelectedRegion('INDIA');
            }
            fetchData();
            break;

          case 'PROFILE_UPDATED':
            if (msg.data?.id === activeProfile?.id) {
              setActiveProfile(msg.data);
            }
            fetchData();
            break;

          case 'CATALOG_UPDATED':
            fetchData();
            break;

          case 'GST_INVOICE_GENERATED':
          case 'INVOICE_GENERATED':
          case 'INVOICE_READY':
            setGeneratedInvoice(msg.data);
            if (msg.data.auditLog) {
              setAuditLog(msg.data.auditLog);
            }
            setRightTab('invoice');
            fetchData();
            fetch(`/api/integrations/sync/${msg.data.invoiceId}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data) setErpSyncData(data);
              })
              .catch(() => {});
            break;

          case 'AUDIT_LOG_UPDATED':
            if (msg.data.auditLog) {
              setAuditLog(msg.data.auditLog);
            }
            break;

          case 'ERP_SYNCED':
            setErpSyncData(msg.data);
            break;

          case 'INVOICE_PAID':
            soundEngine.playPaymentChime();
            setIsInvoicePaid(true);
            if (msg.data.erpSync) {
              setErpSyncData(msg.data.erpSync);
            }
            setTranscript((prev) => [
              ...prev,
              {
                speaker: 'agent',
                text: `Payment Confirmed: $${msg.data.totalAmount.toFixed(2)} settled via customer checkout portal (${msg.data.transactionId}). Work order closed!`,
                isFinal: true,
                timestamp: Date.now(),
              },
            ]);
            fetchData();
            break;

          case 'AUDIO_CHUNK':
            setPacketsCount((c) => c + 1);
            setLatencyMs(Math.floor(340 + Math.random() * 80));
            if (msg.data.audio) {
              playBase64Pcm(msg.data.audio);
            }
            break;

          case 'INTERRUPTED':
            soundEngine.playBargeInClick();
            stopAudioPlayback();
            break;
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
      stopAudioCapture();
    };
  }, []);

  // Audio Playback
  const playBase64Pcm = (base64Data: string) => {
    try {
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }

      const ctx = audioContextRef.current;
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();

      setIsAgentSpeaking(true);
      source.onended = () => {
        setIsAgentSpeaking(false);
      };
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  };

  const stopAudioPlayback = () => {
    setIsAgentSpeaking(false);
  };

  // Browser Microphone Capture
  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const uint8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Audio = window.btoa(binary);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'AUDIO_INPUT',
              data: { pcm16Base64: base64Audio },
            })
          );
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'START_VOICE_SESSION' }));
      }

      setIsListening(true);
    } catch (err) {
      console.error('Failed to open microphone:', err);
      alert('Microphone access denied or not available. Try the "Run Demo Scenario" button instead!');
    }
  };

  const stopAudioCapture = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'STOP_VOICE_SESSION' }));
    }
    setIsListening(false);
  };

  const handleToggleMic = () => {
    if (isListening) {
      stopAudioCapture();
    } else {
      soundEngine.playRadioChirp();
      startAudioCapture();
    }
  };

  const handleToggleNoise = () => {
    const active = soundEngine.toggleAmbientNoise();
    setIsNoiseActive(active);
  };

  const handleToggleSoundFx = () => {
    soundEngine.enabled = !soundEngine.enabled;
    setIsSoundFxEnabled(soundEngine.enabled);
  };

  // Business Profile & Catalog Handlers
  const handleSwitchProfile = async (profileId: string) => {
    try {
      const res = await fetch('/api/business-profile/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (data.activeProfile) {
        setActiveProfile(data.activeProfile);
        if (data.activeProfile.region === 'GLOBAL' || data.activeProfile.taxSystem !== 'GST_INDIA') {
          setSelectedRegion('GLOBAL');
        } else {
          setSelectedRegion('INDIA');
        }
      }
      fetchData();
    } catch (err) {
      console.error('Error switching business profile:', err);
    }
  };

  const handleRegionChange = (newRegion: 'INDIA' | 'GLOBAL') => {
    setSelectedRegion(newRegion);
    const matching = profiles.find((p) => {
      if (newRegion === 'INDIA') return p.region === 'INDIA' || p.taxSystem === 'GST_INDIA';
      return p.region === 'GLOBAL' || p.taxSystem !== 'GST_INDIA';
    });
    if (matching && matching.id !== activeProfile?.id) {
      handleSwitchProfile(matching.id);
    }
  };

  const handleSaveTaxRate = async (profileId: string, taxRate: number, taxLabel: string) => {
    try {
      const res = await fetch(`/api/business-profile/${profileId}/tax-rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxRate, taxLabel }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setActiveProfile(data.profile);
        }
        fetchData();
      }
    } catch (err) {
      console.error('Error updating tax rate:', err);
    }
  };

  const handleAddCatalogItem = async (item: Partial<CatalogItem> & { name: string }) => {
    try {
      const res = await fetch('/api/catalog/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error adding catalog item:', err);
    }
  };

  const handleDeleteCatalogItem = async (sku: string) => {
    try {
      const res = await fetch(`/api/catalog/item/${sku}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error deleting catalog item:', err);
    }
  };

  // Run Demo Scenario
  const handleRunScenario = async (scenarioId?: string) => {
    setIsSimulating(true);
    setTranscript([]);
    setToolLogs([]);
    setGeneratedInvoice(null);
    setNotificationSent(false);
    setIsInvoicePaid(false);
    setErpSyncData(null);
    setIsERPOpen(false);
    setAuditLog([]);

    const chosenId = scenarioId || (activeProfile?.taxSystem === 'GST_INDIA' ? 'indian-pc-builder' : 'johnson-cooling');

    try {
      await fetch('/api/simulation/run-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: chosenId }),
      });
    } catch (err) {
      console.error('Error triggering simulation scenario:', err);
      setIsSimulating(false);
    }
  };

  // Reset Demo Seed
  const handleResetDemo = async () => {
    try {
      await fetch('/api/reset-demo', { method: 'POST' });
      setTranscript([]);
      setToolLogs([]);
      setGeneratedInvoice(null);
      setNotificationSent(false);
      setIsInvoicePaid(false);
      setIsCheckoutOpen(false);
      setErpSyncData(null);
      setIsERPOpen(false);
      setAuditLog([]);
      fetchData();
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  // Re-sync ERP manually
  const handleTriggerReSync = async () => {
    if (!generatedInvoice) return;
    try {
      const res = await fetch(`/api/integrations/sync/${generatedInvoice.invoiceId}`, { method: 'POST' });
      const data = await res.json();
      if (data.syncResult) {
        setErpSyncData(data.syncResult);
        soundEngine.playToolSuccessChime();
      }
    } catch (err) {
      console.error('Re-sync error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        isConnected={isConnected}
        isSimulating={isSimulating}
        onRunScenario={handleRunScenario}
        onResetDemo={handleResetDemo}
        sessionMode={sessionMode}
        activeProfile={activeProfile}
        profiles={profiles}
        onSwitchProfile={handleSwitchProfile}
        onOpenCatalog={() => setIsCatalogModalOpen(true)}
        selectedRegion={selectedRegion}
        onRegionChange={handleRegionChange}
        onOpenTaxSettings={() => setIsTaxSettingsOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Work Orders & Van Inventory (4 cols) */}
        <div className="lg:col-span-4">
          <JobsAndInventory
            workOrders={workOrders}
            inventory={inventory}
            activeWorkOrderId={activeWorkOrderId}
            onSelectWorkOrder={(id) => setActiveWorkOrderId(id)}
            currencySymbol={activeProfile?.currencySymbol || '$'}
            businessType={activeProfile?.businessType}
          />
        </div>

        {/* Center Column: Hands-Free Voice Console & Transcript (4 cols) */}
        <div className="lg:col-span-4">
          <VoiceConsole
            isListening={isListening}
            isAgentSpeaking={isAgentSpeaking}
            transcript={transcript}
            onToggleMic={handleToggleMic}
            twilioNumber="+1 (512) 555-0199"
            latencyMs={latencyMs}
            packetsCount={packetsCount}
            isNoiseActive={isNoiseActive}
            onToggleNoise={handleToggleNoise}
            isSoundFxEnabled={isSoundFxEnabled}
            onToggleSoundFx={handleToggleSoundFx}
          />
        </div>

        {/* Right Column: PDF Invoice & Tool Execution Stream (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col h-[740px] shadow-xl overflow-hidden">
            {/* Tab Switcher */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
              <button
                onClick={() => setRightTab('invoice')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  rightTab === 'invoice'
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Invoice PDF</span>
              </button>
              <button
                onClick={() => setRightTab('tools')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  rightTab === 'tools'
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Tool Stream ({toolLogs.length})</span>
              </button>
              <button
                onClick={() => setRightTab('roi')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  rightTab === 'roi'
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Fleet ROI</span>
              </button>
              <button
                onClick={() => setRightTab('audit')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  rightTab === 'audit'
                    ? 'bg-slate-800 text-amber-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Audit{auditLog.length > 0 ? ` (${auditLog.length})` : ''}</span>
              </button>
            </div>

            <div className="flex-1 overflow-hidden p-3">
              {rightTab === 'invoice' ? (
                <InvoiceViewer
                  invoice={generatedInvoice}
                  notificationSent={notificationSent}
                  isPaid={isInvoicePaid}
                  erpData={erpSyncData}
                  auditEntriesCount={auditLog.length}
                  onOpenCheckout={() => setIsCheckoutOpen(true)}
                  onOpenERP={() => setIsERPOpen(true)}
                  onOpenAudit={() => setRightTab('audit')}
                />
              ) : rightTab === 'tools' ? (
                <ToolTimeline toolLogs={toolLogs} />
              ) : rightTab === 'audit' ? (
                <AuditTrailPanel auditLog={auditLog} />
              ) : (
                <FleetROI />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Interactive Customer Payment & Sign-Off Portal Modal */}
      <CustomerCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        invoice={generatedInvoice}
        onPaymentSuccess={() => {
          setIsInvoicePaid(true);
          fetchData();
        }}
      />

      {/* Enterprise ERP & General Ledger Inspection Modal */}
      <ERPIntegrationsModal
        isOpen={isERPOpen}
        onClose={() => setIsERPOpen(false)}
        erpData={erpSyncData}
        onTriggerReSync={handleTriggerReSync}
      />

      {/* Shopkeeper Catalog & GST Slabs Modal */}
      <CatalogManagerModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        catalog={catalog}
        activeProfile={activeProfile}
        onItemAdded={handleAddCatalogItem}
        onItemDeleted={handleDeleteCatalogItem}
      />

      {/* Global Shopkeeper Custom Country Tax Modal */}
      <TaxSettingsModal
        isOpen={isTaxSettingsOpen}
        onClose={() => setIsTaxSettingsOpen(false)}
        activeProfile={activeProfile}
        onSaveTaxRate={handleSaveTaxRate}
      />
    </div>
  );
}
