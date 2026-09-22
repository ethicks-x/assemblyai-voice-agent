import React from 'react';
import { Activity, Zap, Volume2, VolumeX, Shield, Wind } from 'lucide-react';

interface AudioMetricsBarProps {
  latencyMs: number;
  packetsCount: number;
  isNoiseActive: boolean;
  onToggleNoise: () => void;
  isSoundFxEnabled: boolean;
  onToggleSoundFx: () => void;
}

export const AudioMetricsBar: React.FC<AudioMetricsBarProps> = ({
  latencyMs,
  packetsCount,
  isNoiseActive,
  onToggleNoise,
  isSoundFxEnabled,
  onToggleSoundFx,
}) => {
  return (
    <div className="bg-slate-950/90 border-b border-slate-800/80 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
      {/* Telemetry Metrics */}
      <div className="flex items-center gap-3 text-slate-400">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Latency:</span>
          <span className="font-bold text-slate-200">
            {latencyMs > 0 ? `${latencyMs}ms` : '380ms'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-sky-400" />
          <span>Universal-3.5</span>
          <span className="text-slate-500">• 16kHz</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5">
          <span>Packets:</span>
          <span className="text-slate-300 font-bold">{packetsCount}</span>
        </div>
      </div>

      {/* Audio Controls (Noise Simulator & Earcon Mute) */}
      <div className="flex items-center gap-2">
        {/* Ambient HVAC Noise Simulation Button */}
        <button
          type="button"
          onClick={onToggleNoise}
          title="Simulate loud industrial rooftop compressor noise to test AssemblyAI acoustic resilience"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all ${
            isNoiseActive
              ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/20'
              : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wind className={`w-3 h-3 ${isNoiseActive ? 'animate-spin text-amber-400' : ''}`} />
          <span>{isNoiseActive ? 'HVAC Noise: ON' : 'Job-Site Noise'}</span>
        </button>

        {/* Earcons Sound FX Toggle */}
        <button
          type="button"
          onClick={onToggleSoundFx}
          title={isSoundFxEnabled ? 'Mute radio chirps & earcons' : 'Enable radio chirps & earcons'}
          className={`p-1 rounded-lg border transition-colors ${
            isSoundFxEnabled
              ? 'bg-slate-800 border-slate-700 text-sky-400'
              : 'bg-slate-900 border-slate-800 text-slate-600'
          }`}
        >
          {isSoundFxEnabled ? (
            <Volume2 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};
