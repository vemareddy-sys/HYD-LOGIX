import { describe, it, expect, beforeAll } from 'vitest';
import { GraphEngine } from '../../graph/GraphEngine';
import * as fs from 'fs';
import * as path from 'path';
import {
  validateVehicleCapacity,
  planStopSequence,
  planDeliveryRun,
} from '../stopPlanner';
import type { Order, Warehouse, Vehicle } from '../../types/logistics';

describe('HYD-LOGIX Phase 05/06 Stop Planner & Multi-Leg Route Generation', () => {
  let graphEngine: GraphEngine;

  const mockWarehouse: Warehouse = {
    id: 'wh-gachibowli',
    name: 'Gachibowli Distribution Hub',
    address_label: 'DLF Cybercity, Gachibowli',
    latitude: 17.4435,
    longitude: 78.3575,
    nearest_graph_node_id: 'node_12632759800',
    created_at: '2026-09-18T10:00:00Z',
    updated_at: '2026-09-18T10:00:00Z',
  };

  const mockVehicleVan02: Vehicle = {
    id: 'veh-van-02',
    vehicle_code: 'VAN-02',
    type: 'VAN',
    status: 'AVAILABLE',
    capacity_kg: 750,
    assigned_driver_id: null,
    created_at: '2026-09-18T10:00:00Z',
    updated_at: '2026-09-18T10:00:00Z',
  };

  const orderA: Order = {
    id: 'ord-a',
    order_code: 'ORD-A-MED',
    package_name: 'Medicine',
    package_description: 'Emergency Supplies',
    weight_kg: 2,
    warehouse_id: mockWarehouse.id,
    destination_label: 'Madhapur Tech Zone',
    destination_latitude: 17.4483,
    destination_longitude: 78.3915,
    destination_graph_node_id: 'node_1302063231',
    priority: 'URGENT',
    status: 'PENDING',
    created_by: null,
    created_at: '2026-09-18T11:00:00Z',
    updated_at: '2026-09-18T11:00:00Z',
  };

  const orderB: Order = {
    id: 'ord-b',
    order_code: 'ORD-B-LAP',
    package_name: 'Laptop',
    package_description: 'Electronics',
    weight_kg: 3,
    warehouse_id: mockWarehouse.id,
    destination_label: 'HITEC City Cyber Towers',
    destination_latitude: 17.4504,
    destination_longitude: 78.3808,
    destination_graph_node_id: 'node_3163973600',
    priority: 'HIGH',
    status: 'PENDING',
    created_by: null,
    created_at: '2026-09-18T11:05:00Z',
    updated_at: '2026-09-18T11:05:00Z',
  };

  const orderC: Order = {
    id: 'ord-c',
    order_code: 'ORD-C-DOC',
    package_name: 'Documents',
    package_description: 'Legal Paperwork',
    weight_kg: 1,
    warehouse_id: mockWarehouse.id,
    destination_label: 'Jubilee Hills Checkpost',
    destination_latitude: 17.4319,
    destination_longitude: 78.4071,
    destination_graph_node_id: 'node_1948662052',
    priority: 'NORMAL',
    status: 'PENDING',
    created_by: null,
    created_at: '2026-09-18T11:10:00Z',
    updated_at: '2026-09-18T11:10:00Z',
  };

  beforeAll(() => {
    const dataDir = path.resolve(__dirname, '../../../public/data/hyderabad');
    const nodes = JSON.parse(fs.readFileSync(path.join(dataDir, 'nodes.json'), 'utf-8'));
    const edges = JSON.parse(fs.readFileSync(path.join(dataDir, 'edges.json'), 'utf-8'));
    const metadata = JSON.parse(fs.readFileSync(path.join(dataDir, 'metadata.json'), 'utf-8'));
    graphEngine = new GraphEngine(nodes, edges, metadata);
  });

  describe('Vehicle Capacity Validation', () => {
    it('approves orders within vehicle capacity limit', () => {
      const res = validateVehicleCapacity([orderA, orderB, orderC], mockVehicleVan02);
      expect(res.valid).toBe(true);
      expect(res.totalWeight).toBe(6); // 2 + 3 + 1 = 6 kg <= 750 kg
    });

    it('rejects orders exceeding vehicle capacity limit', () => {
      const heavyOrder: Order = {
        ...orderA,
        id: 'ord-heavy',
        weight_kg: 800,
      };
      const res = validateVehicleCapacity([heavyOrder], mockVehicleVan02);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Capacity exceeded');
      expect(res.totalWeight).toBe(800);
    });

    it('rejects orders with negative weight', () => {
      const invalidOrder: Order = {
        ...orderA,
        id: 'ord-neg',
        weight_kg: -5,
      };
      const res = validateVehicleCapacity([invalidOrder], mockVehicleVan02);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('invalid negative weight');
    });
  });

  describe('Deterministic Stop Sequencing', () => {
    it('prioritizes high priority orders while maintaining optimal corridor progression without backtracking', () => {
      const stops = planStopSequence(graphEngine, mockWarehouse, [orderC, orderB, orderA]);
      expect(stops.length).toBe(3);
      // Both URGENT (Madhapur) and HIGH (HITEC City) are delivered before NORMAL (Jubilee Hills)
      const normalIndex = stops.findIndex((s) => s.priority === 'NORMAL');
      const urgentIndex = stops.findIndex((s) => s.priority === 'URGENT');
      const highIndex = stops.findIndex((s) => s.priority === 'HIGH');

      expect(urgentIndex).toBeLessThan(normalIndex);
      expect(highIndex).toBeLessThan(normalIndex);
      expect(stops.map((s) => s.id)).toContain('ord-a');
      expect(stops.map((s) => s.id)).toContain('ord-b');
      expect(stops.map((s) => s.id)).toContain('ord-c');
    });

    it('returns identical sequence for single order', () => {
      const stops = planStopSequence(graphEngine, mockWarehouse, [orderB]);
      expect(stops.length).toBe(1);
      expect(stops[0].id).toBe('ord-b');
    });
  });

  describe('Master Multi-Leg Route Generation (planDeliveryRun)', () => {
    it('plans a complete 3-order delivery run with discrete A* legs', () => {
      const result = planDeliveryRun(
        graphEngine,
        mockWarehouse,
        [orderA, orderB, orderC],
        mockVehicleVan02
      );

      expect(result.success).toBe(true);
      expect(result.orderedStops.length).toBe(3);
      expect(result.legs.length).toBe(3);
      expect(result.totalWeightKg).toBe(6);
      expect(result.totalDistanceMeters).toBeGreaterThan(0);
      expect(result.totalEffectiveCost).toBeGreaterThan(0);

      // Verify Leg 1: Warehouse -> Stop 1
      const leg1 = result.legs[0];
      expect(leg1.leg_sequence).toBe(1);
      expect(leg1.from_graph_node_id).toBe(mockWarehouse.nearest_graph_node_id);
      expect(leg1.to_graph_node_id).toBe(result.orderedStops[0].destination_graph_node_id);
      expect(leg1.status).toBe('ACTIVE');
      expect(leg1.route_geometry.length).toBeGreaterThan(0);
      expect(leg1.distance_meters).toBeGreaterThan(0);

      // Verify Leg 2: Stop 1 -> Stop 2
      const leg2 = result.legs[1];
      expect(leg2.leg_sequence).toBe(2);
      expect(leg2.from_graph_node_id).toBe(result.orderedStops[0].destination_graph_node_id);
      expect(leg2.to_graph_node_id).toBe(result.orderedStops[1].destination_graph_node_id);
      expect(leg2.status).toBe('PLANNED');
      expect(leg2.route_geometry.length).toBeGreaterThan(0);

      // Verify Leg 3: Stop 2 -> Stop 3
      const leg3 = result.legs[2];
      expect(leg3.leg_sequence).toBe(3);
      expect(leg3.from_graph_node_id).toBe(result.orderedStops[1].destination_graph_node_id);
      expect(leg3.to_graph_node_id).toBe(result.orderedStops[2].destination_graph_node_id);
      expect(leg3.status).toBe('PLANNED');
      expect(leg3.route_geometry.length).toBeGreaterThan(0);

      // Total distance equals sum of leg distances
      const sumDistances = Math.round(
        (leg1.distance_meters + leg2.distance_meters + leg3.distance_meters) * 100
      ) / 100;
      expect(result.totalDistanceMeters).toBe(sumDistances);
    });

    it('rejects delivery run when overweight', () => {
      const overweightVan: Vehicle = {
        ...mockVehicleVan02,
        capacity_kg: 5, // 5kg capacity, but total is 6kg
      };

      const result = planDeliveryRun(
        graphEngine,
        mockWarehouse,
        [orderA, orderB, orderC],
        overweightVan
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Capacity exceeded');
      expect(result.legs.length).toBe(0);
    });
  });
});
