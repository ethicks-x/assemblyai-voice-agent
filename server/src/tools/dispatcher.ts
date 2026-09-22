import { lookupWorkOrder } from './lookupWorkOrder.js';
import { checkTruckInventory } from './inventory.js';
import { calculateBillingAndReadback } from './billing.js';
import { generateInvoicePdf } from './pdfGenerator.js';
import { sendCustomerNotification } from './notification.js';
import { getNextJobAndRoute } from './routing.js';
import { addOrUpdateCatalogItem } from './manageCatalog.js';
import { generateGstTaxInvoice } from './gstPdfGenerator.js';

export interface ToolCallPayload {
  name: string;
  arguments: any;
}

export interface ToolExecutionResponse {
  name: string;
  result: any;
  uiEvent?: {
    type: string;
    data: any;
  };
}

export async function dispatchToolCall(toolCall: ToolCallPayload): Promise<ToolExecutionResponse> {
  const { name } = toolCall;
  const rawArgs = toolCall.arguments;
  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

  console.log(`[Tool Dispatcher] Executing tool: ${name} with args:`, JSON.stringify(args));

  switch (name) {
    case 'lookup_work_order': {
      const result = await lookupWorkOrder(args);
      return {
        name,
        result,
        uiEvent: {
          type: 'WORK_ORDER_LOADED',
          data: result,
        },
      };
    }

    case 'check_truck_inventory': {
      const result = await checkTruckInventory(args);
      return {
        name,
        result,
        uiEvent: {
          type: 'INVENTORY_CHECKED',
          data: result,
        },
      };
    }

    case 'calculate_billing_and_readback': {
      const result = await calculateBillingAndReadback(args);
      return {
        name,
        result,
        uiEvent: {
          type: 'BILLING_CALCULATED',
          data: result,
        },
      };
    }

    case 'generate_invoice_pdf': {
      const result = await generateInvoicePdf(args);
      return {
        name,
        result,
        uiEvent: {
          type: 'INVOICE_GENERATED',
          data: result,
        },
      };
    }

    case 'generate_gst_tax_invoice': {
      const result = await generateGstTaxInvoice(args);
      return {
        name,
        result,
        uiEvent: {
          type: 'GST_INVOICE_GENERATED',
          data: result,
        },
      };
    }

    case 'add_or_update_catalog_item': {
      const result = await addOrUpdateCatalogItem(args);
      return {
        name,
        result,
        uiEvent: {
          type: 'CATALOG_UPDATED',
          data: result,
        },
      };
    }

    case 'send_customer_notification': {
      const result = await sendCustomerNotification(args);
      return {
        name,
        result,
        uiEvent: {
          type: 'NOTIFICATION_SENT',
          data: result,
        },
      };
    }

    case 'get_next_job_and_route': {
      const result = await getNextJobAndRoute(args);
      return {
        name,
        result,
        uiEvent: {
          type: 'NEXT_JOB_ROUTED',
          data: result,
        },
      };
    }

    default:
      return {
        name,
        result: {
          error: `Unknown tool: ${name}`,
        },
      };
  }
}
