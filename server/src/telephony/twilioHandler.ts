import WebSocket from 'ws';
import { AssemblyAIVoiceSession } from '../agent/voiceSession.js';
import { muLaw8kToPcm16k, pcm16kToMuLaw8k } from './audioConverter.js';

export interface TelephonyBroadcastCallbacks {
  onCallStarted: (callSid: string, streamSid: string) => void;
  onCallEnded: (callSid: string) => void;
  onTranscript: (speaker: 'technician' | 'agent', text: string, isFinal: boolean) => void;
  onToolEvent: (event: any) => void;
}

export function handleTwilioMediaStream(ws: WebSocket, callbacks?: TelephonyBroadcastCallbacks) {
  let streamSid: string | null = null;
  let callSid: string | null = null;
  let voiceSession: AssemblyAIVoiceSession | null = null;

  console.log('[Twilio MediaStream] Twilio connected via WebSocket.');

  ws.on('message', async (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          console.log(`[Twilio MediaStream] Call started. StreamSid: ${streamSid}, CallSid: ${callSid}`);
          callbacks?.onCallStarted(callSid || 'unknown', streamSid || 'unknown');

          // Initialize Voice Agent Session
          voiceSession = new AssemblyAIVoiceSession({
            sessionId: streamSid || 'twilio-session',
            onTranscript: (speaker, text, isFinal) => {
              callbacks?.onTranscript(speaker, text, isFinal);
            },
            onAudioOutput: (audioBase64Pcm16) => {
              if (streamSid && ws.readyState === WebSocket.OPEN) {
                const pcmBuffer = Buffer.from(audioBase64Pcm16, 'base64');
                const muLawBuffer = pcm16kToMuLaw8k(pcmBuffer);
                ws.send(
                  JSON.stringify({
                    event: 'media',
                    streamSid,
                    media: {
                      payload: muLawBuffer.toString('base64'),
                    },
                  })
                );
              }
            },
            onToolEvent: (toolEvt) => {
              callbacks?.onToolEvent(toolEvt);
            },
            onInterrupted: () => {
              if (streamSid && ws.readyState === WebSocket.OPEN) {
                // Clear Twilio audio queue
                ws.send(
                  JSON.stringify({
                    event: 'clear',
                    streamSid,
                  })
                );
              }
            },
          });

          await voiceSession.connect();
          break;

        case 'media':
          if (voiceSession && msg.media && msg.media.payload) {
            const muLawBuffer = Buffer.from(msg.media.payload, 'base64');
            const pcmBuffer = muLaw8kToPcm16k(muLawBuffer);
            voiceSession.sendAudioChunk(pcmBuffer.toString('base64'));
          }
          break;

        case 'stop':
          console.log(`[Twilio MediaStream] Call ended for stream: ${streamSid}`);
          if (callSid) callbacks?.onCallEnded(callSid);
          if (voiceSession) {
            voiceSession.close();
            voiceSession = null;
          }
          break;
      }
    } catch (err) {
      console.error('[Twilio MediaStream] Error handling message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[Twilio MediaStream] WebSocket disconnected.');
    if (voiceSession) {
      voiceSession.close();
      voiceSession = null;
    }
  });
}
