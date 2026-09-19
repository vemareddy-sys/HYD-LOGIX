import type { GraphEngine } from '../graph/GraphEngine';
import { runAStar } from './astar';
import type { Order, Warehouse, Vehicle, RouteLegStatus } from '../types/logistics';

export interface PlannedLeg {
  leg_sequence: number;
  from_graph_node_id: string;
  to_graph_node_id: string;
  from_label: string;
  to_label: string;
  order_id: string;
  route_node_ids: string[];
  route_edge_ids: string[];
  route_geometry: [number, number][];
  distance_meters: number;
  effective_cost: number;
  hop_count: number;
  status: RouteLegStatus;
}

export interface StopPlanResult {
  success: boolean;
  error?: string;
  orderedStops: Order[];
  legs: PlannedLeg[];
  totalDistanceMeters: number;
  totalEffectiveCost: number;
  totalWeightKg: number;
  capacityUtilizationPct: number;
}

export const PRIORITY_WEIGHTS: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

/**
 * Validates total order package weight against vehicle capacity.
 */
export function validateVehicleCapacity(
  orders: Order[],
  vehicle: Vehicle | { capacity_kg: number | null; vehicle_code: string }
): { valid: boolean; totalWeight: number; error?: string } {
  let totalWeight = 0;
  for (const order of orders) {
    if (order.weight_kg !== null && order.weight_kg !== undefined) {
      if (order.weight_kg < 0) {
        return {
          valid: false,
          totalWeight,
          error: `Order ${order.order_code} has invalid negative weight (${order.weight_kg} kg).`,
        };
      }
      totalWeight += order.weight_kg;
    }
  }

  if (vehicle.capacity_kg !== null && vehicle.capacity_kg !== undefined && vehicle.capacity_kg > 0) {
    if (totalWeight > vehicle.capacity_kg) {
      return {
        valid: false,
        totalWeight,
        error: `Capacity exceeded: Total payload ${totalWeight} kg exceeds vehicle ${vehicle.vehicle_code} limit of ${vehicle.capacity_kg} kg.`,
      };
    }
  }

  return { valid: true, totalWeight };
}

/**
 * Calculates straight-line / approximate distance between two graph nodes or lat/lng.
 */
function getCostBetweenNodes(
  graphEngine: GraphEngine,
  fromNodeId: string,
  toNodeId: string
): number {
  if (fromNodeId === toNodeId) return 0;
  // Use A* on the graph for deterministic accurate routing cost
  const res = runAStar(graphEngine, {
    startNodeId: fromNodeId,
    goalNodeId: toNodeId,
    traceEnabled: false,
  });
  return res.found ? res.effectiveCost : Infinity;
}

/**
 * Sequence stops using priority weighting and incremental insertion cost.
 * Starts from warehouse origin and determines the sequence of deliveries.
 */
export function planStopSequence(
  graphEngine: GraphEngine,
  warehouse: Warehouse,
  orders: Order[]
): Order[] {
  if (orders.length <= 1) return [...orders];

  // 1. Initial sort: Priority descending, then order age (created_at ascending)
  const pool = [...orders].sort((a, b) => {
    const pA = PRIORITY_WEIGHTS[a.priority] || 1;
    const pB = PRIORITY_WEIGHTS[b.priority] || 1;
    if (pB !== pA) return pB - pA;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // 2. Start route with warehouse node and first (highest priority) order
  const plannedRoute: Order[] = [pool.shift()!];

  // 3. Incrementally insert remaining orders into the position with minimum additional cost adjusted by priority
  // Priority factor in meters (e.g. 800m advantage per priority point difference)
  const PRIORITY_ADVANTAGE_METERS = 800;

  while (pool.length > 0) {
    const candidate = pool.shift()!;
    const candidatePriority = PRIORITY_WEIGHTS[candidate.priority] || 1;

    let bestInsertionIndex = plannedRoute.length;
    let lowestInsertionScore = Infinity;

    // Evaluate inserting candidate at every valid position (0 to plannedRoute.length)
    for (let pos = 0; pos <= plannedRoute.length; pos++) {
      const prevNodeId =
        pos === 0
          ? warehouse.nearest_graph_node_id
          : plannedRoute[pos - 1].destination_graph_node_id;

      const nextNodeId =
        pos === plannedRoute.length
          ? null
          : plannedRoute[pos].destination_graph_node_id;

      const costToCandidate = getCostBetweenNodes(
        graphEngine,
        prevNodeId,
        candidate.destination_graph_node_id
      );

      let costFromCandidate = 0;
      let originalSegmentCost = 0;

      if (nextNodeId) {
        costFromCandidate = getCostBetweenNodes(
          graphEngine,
          candidate.destination_graph_node_id,
          nextNodeId
        );
        originalSegmentCost = getCostBetweenNodes(graphEngine, prevNodeId, nextNodeId);
      }

      const deltaCost = costToCandidate + costFromCandidate - originalSegmentCost;

      // Score: deltaCost discounted by priority and position bias (earlier positions preferred for high priority)
      const priorityBonus = candidatePriority * PRIORITY_ADVANTAGE_METERS * (plannedRoute.length - pos + 1);
      const score = deltaCost - priorityBonus;

      if (score < lowestInsertionScore) {
        lowestInsertionScore = score;
        bestInsertionIndex = pos;
      }
    }

    plannedRoute.splice(bestInsertionIndex, 0, candidate);
  }

  return plannedRoute;
}

/**
 * Master Plan Function: Validates vehicle capacity, plans deterministic stop sequence,
 * and calculates all discrete A* road route legs over the real Hyderabad road graph.
 */
export function planDeliveryRun(
  graphEngine: GraphEngine,
  warehouse: Warehouse,
  orders: Order[],
  vehicle: Vehicle | { capacity_kg: number | null; vehicle_code: string }
): StopPlanResult {
  if (!orders || orders.length === 0) {
    return {
      success: false,
      error: 'Cannot plan delivery run with zero orders.',
      orderedStops: [],
      legs: [],
      totalDistanceMeters: 0,
      totalEffectiveCost: 0,
      totalWeightKg: 0,
      capacityUtilizationPct: 0,
    };
  }

  // 1. Validate Capacity
  const capacityCheck = validateVehicleCapacity(orders, vehicle);
  if (!capacityCheck.valid) {
    return {
      success: false,
      error: capacityCheck.error,
      orderedStops: [],
      legs: [],
      totalDistanceMeters: 0,
      totalEffectiveCost: 0,
      totalWeightKg: capacityCheck.totalWeight,
      capacityUtilizationPct:
        vehicle.capacity_kg && vehicle.capacity_kg > 0
          ? Math.round((capacityCheck.totalWeight / vehicle.capacity_kg) * 100)
          : 0,
    };
  }

  // 2. Plan Stop Sequence
  const orderedStops = planStopSequence(graphEngine, warehouse, orders);

  // 3. Compute A* Route Legs connecting consecutive stops
  const legs: PlannedLeg[] = [];
  let totalDistanceMeters = 0;
  let totalEffectiveCost = 0;

  for (let i = 0; i < orderedStops.length; i++) {
    const currentOrder = orderedStops[i];
    const fromNodeId =
      i === 0
        ? warehouse.nearest_graph_node_id
        : orderedStops[i - 1].destination_graph_node_id;

    const toNodeId = currentOrder.destination_graph_node_id;

    const fromLabel = i === 0 ? warehouse.name : orderedStops[i - 1].destination_label;
    const toLabel = currentOrder.destination_label;

    const astarResult = runAStar(graphEngine, {
      startNodeId: fromNodeId,
      goalNodeId: toNodeId,
      traceEnabled: false,
    });

    if (!astarResult.found || astarResult.pathEdgeIds.length === 0) {
      return {
        success: false,
        error: `Routing failure: No valid road path found between "${fromLabel}" and "${toLabel}" in Hyderabad graph.`,
        orderedStops: [],
        legs: [],
        totalDistanceMeters: 0,
        totalEffectiveCost: 0,
        totalWeightKg: capacityCheck.totalWeight,
        capacityUtilizationPct: 0,
      };
    }

    // Reconstruct road coordinates geometry
    const geometry: [number, number][] = [];
    for (const edgeId of astarResult.pathEdgeIds) {
      const edge = graphEngine.getEdge(edgeId);
      if (edge && edge.geometry && edge.geometry.length > 0) {
        for (const pt of edge.geometry) {
          geometry.push(pt);
        }
      }
    }

    if (geometry.length === 0) {
      for (const nodeId of astarResult.pathNodeIds) {
        const node = graphEngine.getNode(nodeId);
        if (node) geometry.push([node.lat, node.lng]);
      }
    }

    legs.push({
      leg_sequence: i + 1,
      from_graph_node_id: fromNodeId,
      to_graph_node_id: toNodeId,
      from_label: fromLabel,
      to_label: toLabel,
      order_id: currentOrder.id,
      route_node_ids: astarResult.pathNodeIds,
      route_edge_ids: astarResult.pathEdgeIds,
      route_geometry: geometry,
      distance_meters: astarResult.distanceMeters,
      effective_cost: astarResult.effectiveCost,
      hop_count: astarResult.hopCount,
      status: i === 0 ? 'ACTIVE' : 'PLANNED',
    });

    totalDistanceMeters += astarResult.distanceMeters;
    totalEffectiveCost += astarResult.effectiveCost;
  }

  const capacityPct =
    vehicle.capacity_kg && vehicle.capacity_kg > 0
      ? Math.round((capacityCheck.totalWeight / vehicle.capacity_kg) * 100)
      : 0;

  return {
    success: true,
    orderedStops,
    legs,
    totalDistanceMeters: Math.round(totalDistanceMeters * 100) / 100,
    totalEffectiveCost: Math.round(totalEffectiveCost * 100) / 100,
    totalWeightKg: capacityCheck.totalWeight,
    capacityUtilizationPct: capacityPct,
  };
}
