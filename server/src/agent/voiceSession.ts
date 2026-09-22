import WebSocket from 'ws';
import { SYSTEM_PROMPT, AGENT_TOOLS } from './agentConfig.js';
import { dispatchToolCall } from '../tools/dispatcher.js';

export interface VoiceSessionOptions {
  sessionId: string;
  apiKey?: string;
  onTranscript?: (speaker: 'technician' | 'agent', text: string, isFinal: boolean) => void;
  onAudioOutput?: (audioBase64: string) => void;
  onToolEvent?: (event: { name: string; args: any; result: any }) => void;
  onInterrupted?: () => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export class AssemblyAIVoiceSession {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private options: VoiceSessionOptions;
  private apiKey: string;

  constructor(options: VoiceSessionOptions) {
    this.options = options;
    this.apiKey = options.apiKey || process.env.ASSEMBLYAI_API_KEY || '';
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.apiKey || this.apiKey.includes('your_assemblyai_api_key')) {
        console.warn('[AssemblyAI Voice] No valid ASSEMBLYAI_API_KEY found. Running in local simulation mode.');
        this.isConnected = true;
        resolve(false);
        return;
      }

      const endpoint = 'wss://agents.assemblyai.com/v1/ws';
      console.log(`[AssemblyAI Voice] Connecting to ${endpoint}...`);

      try {
        this.ws = new WebSocket(endpoint, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        this.ws.on('open', () => {
          console.log('[AssemblyAI Voice] WebSocket connected successfully!');
          this.isConnected = true;

          // Send session configuration
          const sessionUpdate = {
            type: 'session.update',
            session: {
              system_prompt: SYSTEM_PROMPT,
              greeting: 'Apex FieldPilot online. What job did you just wrap up?',
              tools: AGENT_TOOLS,
            },
          };

          this.ws?.send(JSON.stringify(sessionUpdate));
          resolve(true);
        });

        this.ws.on('message', async (data: WebSocket.RawData) => {
          try {
            const message = JSON.parse(data.toString());
            await this.handleServerMessage(message);
          } catch (err) {
            console.error('[AssemblyAI Voice] Error parsing incoming WS message:', err);
          }
        });

        this.ws.on('error', (err) => {
          console.error('[AssemblyAI Voice] WebSocket error:', err);
          this.options.onError?.(err);
          reject(err);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[AssemblyAI Voice] WebSocket closed (code: ${code}, reason: ${reason.toString()})`);
          this.isConnected = false;
          this.options.onClose?.();
        });
      } catch (err: any) {
        console.error('[AssemblyAI Voice] Failed to establish WS connection:', err);
        reject(err);
      }
    });
  }

  private async handleServerMessage(msg: any) {
    const type = msg.type || msg.event;

    switch (type) {
      case 'transcript.partial':
      case 'speech.partial':
        if (msg.text) {
          const speaker = msg.speaker === 'agent' ? 'agent' : 'technician';
          this.options.onTranscript?.(speaker, msg.text, false);
        }
        break;

      case 'transcript.final':
      case 'speech.final':
        if (msg.text) {
          const speaker = msg.speaker === 'agent' ? 'agent' : 'technician';
          this.options.onTranscript?.(speaker, msg.text, true);
        }
        break;

      case 'audio':
      case 'output.audio':
        if (msg.audio) {
          this.options.onAudioOutput?.(msg.audio);
        }
        break;

      case 'tool.call':
      case 'tool_call': {
        const callId = msg.call_id || msg.id;
        const toolName = msg.name || msg.function?.name;
        const args = msg.arguments || msg.function?.arguments || {};

        console.log(`[AssemblyAI Voice] Tool invocation requested: ${toolName}`, args);

        try {
          const execution = await dispatchToolCall({ name: toolName, arguments: args });

          this.options.onToolEvent?.({
            name: toolName,
            args,
            result: execution.result,
          });

          // Reply with tool.result
          const toolResult = {
            type: 'tool.result',
            call_id: callId,
            result: execution.result,
          };

          this.ws?.send(JSON.stringify(toolResult));
        } catch (err: any) {
          console.error(`[AssemblyAI Voice] Error executing tool ${toolName}:`, err);
          this.ws?.send(
            JSON.stringify({
              type: 'tool.result',
              call_id: callId,
              result: { error: err.message || 'Tool execution failed' },
            })
          );
        }
        break;
      }

      case 'interruption':
      case 'barge_in':
        console.log('[AssemblyAI Voice] Technician interrupted agent speech.');
        this.options.onInterrupted?.();
        break;

      default:
        // Other lifecycle events (session.created, reply.done, etc.)
        break;
    }
  }

  public sendAudioChunk(pcm16Base64: string) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload = {
      type: 'input.audio',
      audio: pcm16Base64,
    };

    this.ws.send(JSON.stringify(payload));
  }

  public close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.isConnected = false;
  }
}
