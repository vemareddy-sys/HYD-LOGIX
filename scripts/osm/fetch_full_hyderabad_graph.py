#!/usr/bin/env python3
"""
HYD-LOGIX Phase 01B: Wider Hyderabad Road Network Preprocessing
Acquires the wider Hyderabad urban drivable road network to measure performance,
node/edge scale, and memory footprint.
"""

import json
import os
import time
import osmnx as ox
from shapely.geometry import LineString

# Output Directory for Wider Hyderabad Dataset
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public", "data", "hyderabad_full")
OUTPUT_DIR = os.path.abspath(OUTPUT_DIR)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Wider Hyderabad Urban Bounding Box: (west, south, east, north)
WIDER_HYDERABAD_BBOX = (78.3000, 17.3000, 78.5500, 17.5200)

def normalize_name(val):
    if not val:
        return "Unnamed Road"
    if isinstance(val, list):
        return " / ".join([str(x) for x in val if x])
    return str(val)

def normalize_highway(val):
    if not val:
        return "unclassified"
    if isinstance(val, list):
        return str(val[0])
    return str(val)

def normalize_oneway(val):
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ["true", "yes", "1"]
    if isinstance(val, list):
        return any(normalize_oneway(x) for x in val)
    return False

def normalize_maxspeed(val):
    if not val:
        return None
    try:
        if isinstance(val, list):
            val = val[0]
        num = "".join([c for c in str(val) if c.isdigit()])
        return int(num) if num else None
    except Exception:
        return None

def process_graph(G, region_name="Wider Hyderabad Urban Area"):
    print(f"\n--- Processing Graph for {region_name} ---")
    start_time = time.time()

    nodes_list = []
    edges_list = []

    min_lat, max_lat = 90.0, -90.0
    min_lng, max_lng = 180.0, -180.0

    for u, data in G.nodes(data=True):
        lat = round(float(data["y"]), 7)
        lng = round(float(data["x"]), 7)
        node_id = f"node_{u}"

        min_lat = min(min_lat, lat)
        max_lat = max(max_lat, lat)
        min_lng = min(min_lng, lng)
        max_lng = max(max_lng, lng)

        nodes_list.append({
            "id": node_id,
            "lat": lat,
            "lng": lng
        })

    parallel_edge_count = 0
    seen_pairs = set()

    for u, v, k, data in G.edges(keys=True, data=True):
        from_id = f"node_{u}"
        to_id = f"node_{v}"
        edge_id = f"edge_{u}_{v}_{k}"

        pair = (u, v)
        if pair in seen_pairs:
            parallel_edge_count += 1
        else:
            seen_pairs.add(pair)

        geom_coords = []
        if "geometry" in data and isinstance(data["geometry"], LineString):
            geom_coords = [[round(lat, 7), round(lng, 7)] for lng, lat in data["geometry"].coords]
        else:
            u_lat, u_lng = G.nodes[u]["y"], G.nodes[u]["x"]
            v_lat, v_lng = G.nodes[v]["y"], G.nodes[v]["x"]
            geom_coords = [
                [round(u_lat, 7), round(u_lng, 7)],
                [round(v_lat, 7), round(v_lng, 7)]
            ]

        length_meters = round(float(data.get("length", 0.0)), 2)

        edges_list.append({
            "id": edge_id,
            "from": from_id,
            "to": to_id,
            "key": str(k),
            "lengthMeters": length_meters,
            "geometry": geom_coords,
            "roadName": normalize_name(data.get("name")),
            "roadType": normalize_highway(data.get("highway")),
            "oneWay": normalize_oneway(data.get("oneway")),
            "maxSpeed": normalize_maxspeed(data.get("maxspeed")),
            "trafficFactor": 1.0,
            "blocked": False
        })

    processing_duration = round(time.time() - start_time, 3)

    nodes_file = os.path.join(OUTPUT_DIR, "nodes.json")
    edges_file = os.path.join(OUTPUT_DIR, "edges.json")
    metadata_file = os.path.join(OUTPUT_DIR, "metadata.json")

    with open(nodes_file, "w", encoding="utf-8") as f:
        json.dump(nodes_list, f, separators=(',', ':'))

    with open(edges_file, "w", encoding="utf-8") as f:
        json.dump(edges_list, f, separators=(',', ':'))

    nodes_size_kb = round(os.path.getsize(nodes_file) / 1024, 2)
    edges_size_kb = round(os.path.getsize(edges_file) / 1024, 2)
    total_size_mb = round((nodes_size_kb + edges_size_kb) / 1024, 2)

    metadata = {
        "regionName": region_name,
        "source": "OpenStreetMap contributors via OSMnx",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "nodeCount": len(nodes_list),
        "directedEdgeCount": len(edges_list),
        "parallelEdgeCount": parallel_edge_count,
        "bounds": {
            "minLat": min_lat,
            "maxLat": max_lat,
            "minLng": min_lng,
            "maxLng": max_lng
        },
        "fileSizes": {
            "nodesKb": nodes_size_kb,
            "edgesKb": edges_size_kb,
            "totalMb": total_size_mb
        },
        "processingTimeSeconds": processing_duration,
        "preprocessingVersion": "1.0.0",
        "geometryRetained": True
    }

    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n[SUCCESS] Preprocessing completed in {processing_duration}s.")
    print(f"- Node Count: {len(nodes_list)}")
    print(f"- Directed Edge Count: {len(edges_list)}")
    print(f"- Parallel Edges Retained: {parallel_edge_count}")
    print(f"- Output Directory: {OUTPUT_DIR}")
    print(f"- File Sizes: nodes.json ({nodes_size_kb} KB), edges.json ({edges_size_kb} KB), total ({total_size_mb} MB)")

    return metadata

def main():
    print("=== HYD-LOGIX Phase 01B Wider Hyderabad Preprocessing Pipeline ===")
    print("Fetching wider drivable road network for Greater Hyderabad Area...")

    try:
        G = ox.graph_from_bbox(
            bbox=WIDER_HYDERABAD_BBOX,
            network_type="drive"
        )
        print(f"OSMnx Graph acquired: {len(G.nodes)} raw nodes, {len(G.edges)} raw edges.")
        process_graph(G)

    except Exception as e:
        print(f"Error executing pipeline: {e}")
        raise e

if __name__ == "__main__":
    main()
