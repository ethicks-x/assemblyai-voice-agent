import { Router, Request, Response } from 'express';

export const twimlRouter = Router();

twimlRouter.post('/incoming-call', (req: Request, res: Response) => {
  const host = req.headers.host || 'localhost:3001';
  const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
  const streamUrl = `${protocol}://${host}/api/telephony/media-stream`;

  console.log(`[Twilio Inbound] Inbound call received. Connecting media stream to: ${streamUrl}`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Connecting you to Apex FieldPilot voice copilot. Please describe your completed job.</Say>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

twimlRouter.post('/status-callback', (req: Request, res: Response) => {
  console.log('[Twilio Status]', req.body.CallSid, req.body.CallStatus);
  res.sendStatus(200);
});
