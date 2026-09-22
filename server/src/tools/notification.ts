import { db } from '../data/mockDb.js';

export interface SendNotificationParams {
  invoice_id: string;
  method?: 'sms' | 'email' | 'both';
}

export interface SendNotificationResult {
  sent: boolean;
  recipientPhone: string;
  recipientEmail: string;
  smsContent?: string;
  emailSubject?: string;
  paymentUrl: string;
  summaryMessage: string;
}

export async function sendCustomerNotification(params: SendNotificationParams): Promise<SendNotificationResult> {
  const invoice = db.getInvoice(params.invoice_id);
  const method = params.method || 'both';

  if (!invoice) {
    return {
      sent: false,
      recipientPhone: '',
      recipientEmail: '',
      paymentUrl: '',
      summaryMessage: `Could not dispatch notification: Invoice "${params.invoice_id}" not found in system.`,
    };
  }

  const paymentUrl = invoice.paymentUrl || `https://fieldpilot.io/pay/${invoice.id.toLowerCase()}`;
  const smsContent = `Apex Commercial HVAC: Hi ${invoice.clientName}, your service closeout invoice #${invoice.id} for $${invoice.totalAmount.toFixed(2)} is ready. Review and approve online: ${paymentUrl}`;
  const emailSubject = `Apex HVAC Invoice #${invoice.id} - Work Completed at ${invoice.clientAddress}`;

  // Update invoice status
  invoice.status = 'SENT';

  const summaryMessage = `Customer notification dispatched via ${method.toUpperCase()} to ${invoice.clientName} (${invoice.clientPhone} / ${invoice.clientEmail}). Invoice #${invoice.id} payment link active.`;

  return {
    sent: true,
    recipientPhone: invoice.clientPhone,
    recipientEmail: invoice.clientEmail,
    smsContent,
    emailSubject,
    paymentUrl,
    summaryMessage,
  };
}
