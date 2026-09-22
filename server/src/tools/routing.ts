import { db, WorkOrder } from '../data/mockDb.js';

export interface GetNextJobParams {
  current_work_order_id?: string;
}

export interface NextJobDetails {
  id: string;
  clientName: string;
  address: string;
  contactPerson: string;
  phone: string;
  equipment: string;
  reportedIssue: string;
  distanceMiles: number;
  estimatedTransitMins: number;
  suggestedRoute: string;
  appointmentWindow: string;
}

export interface NextJobResult {
  hasNextJob: boolean;
  nextJob?: NextJobDetails;
  spokenSummary: string;
}

export async function getNextJobAndRoute(params: GetNextJobParams): Promise<NextJobResult> {
  const allOrders = db.getAllWorkOrders();
  // Find next dispatched order that is not the current one and not completed
  const nextWo = allOrders.find(
    (wo) => wo.id !== params.current_work_order_id && wo.status !== 'COMPLETED'
  );

  if (!nextWo) {
    return {
      hasNextJob: false,
      spokenSummary: 'You have completed all scheduled tickets for Van #14 today! Head back to the central dispatch shop for evening restock.',
    };
  }

  // Realistic Austin, TX fleet dispatch routing simulation
  const routingTable: Record<string, { miles: number; mins: number; route: string; window: string }> = {
    'WO-1043': {
      miles: 12.4,
      mins: 18,
      route: 'MoPac Expy (TX-1 Loop) South to S Congress Ave',
      window: '2:00 PM - 4:00 PM',
    },
    'WO-1044': {
      miles: 6.8,
      mins: 12,
      route: 'US-183 South to Research Blvd',
      window: '3:30 PM - 5:30 PM',
    },
    'WO-1045': {
      miles: 21.0,
      mins: 26,
      route: 'I-35 South towards Buda Exit 220',
      window: '4:00 PM - 6:00 PM',
    },
  };

  const routeInfo = routingTable[nextWo.id] || {
    miles: 9.5,
    mins: 15,
    route: 'Standard Highway Route',
    window: 'Next Available',
  };

  const spokenSummary = `Next call is ${nextWo.clientName} at ${nextWo.address}. Equipment: ${nextWo.equipment}. Issue reported: "${nextWo.reportedIssue}". Transit time is approximately ${routeInfo.mins} minutes via ${routeInfo.route}. Contact is ${nextWo.contactPerson}.`;

  return {
    hasNextJob: true,
    nextJob: {
      id: nextWo.id,
      clientName: nextWo.clientName,
      address: nextWo.address,
      contactPerson: nextWo.contactPerson,
      phone: nextWo.phone,
      equipment: nextWo.equipment,
      reportedIssue: nextWo.reportedIssue,
      distanceMiles: routeInfo.miles,
      estimatedTransitMins: routeInfo.mins,
      suggestedRoute: routeInfo.route,
      appointmentWindow: routeInfo.window,
    },
    spokenSummary,
  };
}
