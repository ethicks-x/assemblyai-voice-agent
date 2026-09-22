import { db, WorkOrder } from '../data/mockDb.js';

export interface LookupWorkOrderParams {
  query: string;
}

export interface LookupWorkOrderResult {
  found: boolean;
  workOrder?: {
    id: string;
    clientName: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    equipment: string;
    serialNumber: string;
    reportedIssue: string;
    hourlyRate: number;
    isWarranty: boolean;
    status: string;
  };
  message: string;
}

export async function lookupWorkOrder(params: LookupWorkOrderParams): Promise<LookupWorkOrderResult> {
  const wo = db.findWorkOrder(params.query);

  if (!wo) {
    return {
      found: false,
      message: `No active work order found matching "${params.query}". Available clients are: Johnson Cold Storage (WO-1042), Metro 24 Diner (WO-1043), Oakridge Dental Clinic (WO-1044), Lincoln Logistics (WO-1045).`,
    };
  }

  return {
    found: true,
    workOrder: {
      id: wo.id,
      clientName: wo.clientName,
      contactPerson: wo.contactPerson,
      phone: wo.phone,
      email: wo.email,
      address: wo.address,
      equipment: wo.equipment,
      serialNumber: wo.serialNumber,
      reportedIssue: wo.reportedIssue,
      hourlyRate: wo.hourlyRate,
      isWarranty: wo.isWarranty,
      status: wo.status,
    },
    message: `Located work order ${wo.id} for ${wo.clientName} at ${wo.address}. Equipment: ${wo.equipment}. Reported issue: "${wo.reportedIssue}". Standard labor rate is $${wo.hourlyRate.toFixed(2)}/hr.`,
  };
}
