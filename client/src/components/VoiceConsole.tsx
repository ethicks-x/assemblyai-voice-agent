import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, PhoneCall, Bot, User, Radio, Sparkles } from 'lucide-react';
import { AudioMetricsBar } from './AudioMetricsBar';

export interface TranscriptEntry {
  speaker: 'technician' | 'agent';
  text: string;
  isFinal: boolean;
  timestamp?: number;
  source?: 'browser' | 'telephony';
}

interface VoiceConsoleProps {
  isListening: boolean;
  isAgentSpeaking: boolean;
  transcript: TranscriptEntry[];
  onToggleMic: () => void;
  twilioNumber?: string;
  latencyMs?: number;
  packetsCount?: number;
  isNoiseActive?: boolean;
  onToggleNoise?: () => void;
  isSoundFxEnabled?: boolean;
  onToggleSoundFx?: () => void;
}

export const VoiceConsole: React.FC<VoiceConsoleProps> = ({
  isListening,
  isAgentSpeaking,
  transcript,
  onToggleMic,
  twilioNumber = '+1 (512) 555-0199',
  latencyMs = 380,
  packetsCount = 0,
  isNoiseActive = false,
  onToggleNoise = () => {},
  isSoundFxEnabled = true,
  onToggleSoundFx = () => {},
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col h-[740px] shadow-xl overflow-hidden">
      {/* Top Banner: Telephony Showcase */}
      <div className="p-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <PhoneCall className="w-3 h-3 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <span className="text-slate-400 font-medium">Live Telephony Trunk: </span>
            <span className="font-mono font-bold text-slate-100">{twilioNumber}</span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-sky-400/90 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">
          Twilio SIP Stream
        </span>
      </div>

      {/* Live Audio Telemetry & Noise Controls */}
      <AudioMetricsBar
        latencyMs={latencyMs}
        packetsCount={packetsCount}
        isNoiseActive={isNoiseActive}
        onToggleNoise={onToggleNoise}
        isSoundFxEnabled={isSoundFxEnabled}
        onToggleSoundFx={onToggleSoundFx}
      />

      {/* Transcript Scroll View */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-sky-400/60" />
            </div>
            <h4 className="font-semibold text-slate-300 mb-1">FieldPilot Voice Engine Ready</h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Press the microphone below or click <span className="text-sky-400">Run Demo Scenario</span> to start hands-free job closeout, parts pricing, and instant invoice dispatch.
            </p>
          </div>
        ) : (
          transcript.map((entry, idx) => {
            const isAgent = entry.speaker === 'agent';

            return (
              <div
                key={idx}
                className={`flex gap-3 text-xs leading-relaxed ${
                  isAgent ? 'items-start' : 'items-start flex-row-reverse'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-md ${
                    isAgent
                      ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Speech Bubble */}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 shadow-md ${
                    isAgent
                      ? 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-sm'
                      : 'bg-sky-600 text-white rounded-tr-sm'
                  } ${!entry.isFinal ? 'opacity-75 italic' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1 text-[10px] font-mono opacity-60">
                    <span>{isAgent ? 'FieldPilot Copilot' : 'Technician (You)'}</span>
                    {entry.source === 'telephony' && (
                      <span className="text-emerald-300">• Mobile Call</span>
                    )}
                  </div>
                  <p className="text-sm leading-normal">{entry.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Voice Controls Bar */}
      <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex flex-col items-center gap-3">
        {/* Animated Waveform Visualizer */}
        <div className="flex items-center gap-1.5 h-6">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                isListening || isAgentSpeaking
                  ? 'bg-gradient-to-t from-sky-500 to-cyan-300 h-5 animate-pulse'
                  : 'bg-slate-700 h-1.5'
              }`}
              style={{
                animationDelay: `${(i % 5) * 0.15}s`,
                height: isListening || isAgentSpeaking ? `${Math.max(6, (i * 7) % 24)}px` : '4px',
              }}
            />
          ))}
        </div>

        {/* Big Mic Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleMic}
            className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 shadow-xl ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-500/30'
                : 'bg-gradient-to-tr from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 ring-4 ring-sky-500/20'
            }`}
          >
            {isListening ? (
              <MicOff className="w-6 h-6 animate-pulse" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
          <Radio className={`w-3 h-3 ${isListening ? 'text-red-400 animate-ping' : 'text-slate-600'}`} />
          <span>
            {isListening
              ? 'Listening hands-free via AssemblyAI Voice API...'
              : 'Click mic or start demo scenario'}
          </span>
        </div>
      </div>
    </div>
  );
};
