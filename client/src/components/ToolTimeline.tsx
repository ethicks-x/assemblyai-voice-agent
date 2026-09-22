import React from 'react';
import { Terminal, CheckCircle2, Clock, Cpu } from 'lucide-react';

export interface ToolLogEntry {
  id: string;
  name: string;
  status: 'RUNNING' | 'COMPLETED' | 'ERROR';
  args: any;
  result?: any;
  timestamp: number;
}

interface ToolTimelineProps {
  toolLogs: ToolLogEntry[];
}

export const ToolTimeline: React.FC<ToolTimelineProps> = ({ toolLogs }) => {
  if (toolLogs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-3">
          <Terminal className="w-6 h-6 text-slate-500" />
        </div>
        <h4 className="font-semibold text-slate-300 mb-1">Tool Execution Stream</h4>
        <p className="text-xs text-slate-500 max-w-xs">
          As the technician speaks, the AssemblyAI Voice Agent dynamically invokes backend tools via JSON schema calls.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs">
      {toolLogs.map((log) => {
        const isRunning = log.status === 'RUNNING';

        return (
          <div
            key={log.id}
            className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 shadow-md space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-bold text-sky-400">{log.name}()</span>
              </div>
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isRunning
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {isRunning ? (
                  <>
                    <Clock className="w-2.5 h-2.5 animate-spin" />
                    EXECUTING
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    SUCCESS
                  </>
                )}
              </span>
            </div>

            {/* Tool Arguments */}
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/60">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Arguments:
              </div>
              <pre className="text-[11px] text-slate-300 overflow-x-auto">
                {JSON.stringify(log.args, null, 2)}
              </pre>
            </div>

            {/* Tool Output Result */}
            {log.result && (
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/60">
                <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">
                  Response Output:
                </div>
                <pre className="text-[11px] text-emerald-300/90 overflow-x-auto max-h-32">
                  {JSON.stringify(log.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
