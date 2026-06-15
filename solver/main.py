"""
Chonhchoun VRP Solver — v2
Implements:
  - Vehicle capacity constraints (weight per vehicle type)
  - Minimax objective (balance workload across drivers)
  - Minimum stops per driver (force distribution)
  - Time windows per stop (from package priority)
  - Driver shift time windows
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from ortools.constraint_solver import routing_enums_pb2, pywrapcp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Chonhchoun VRP Solver v2", version="2.0.0")

# ── Weight precision: OR-Tools works with integers only ───────────────────────
# Multiply kg values by 10 to preserve one decimal place (e.g. 2.5kg → 25)
WEIGHT_MULTIPLIER = 10


# ── Request / Response models ─────────────────────────────────────────────────

class TimeWindow(BaseModel):
    start: int  # seconds from midnight
    end: int

class StopNode(BaseModel):
    location_index: int        # index into distance_matrix
    demand_kg_x10: int         # total weight demand × 10 (integer for OR-Tools)
    time_window: Optional[TimeWindow] = None  # None = no constraint

class VehicleSpec(BaseModel):
    capacity_kg_x10: int       # max weight capacity × 10
    shift_start: int = 0       # seconds from midnight
    shift_end: int = 86399

class SolveRequest(BaseModel):
    # N×N travel time matrix in seconds. Index 0 = depot.
    distance_matrix: list[list[int]]

    # One entry per vehicle (driver). Length = num_drivers.
    vehicles: list[VehicleSpec]

    # One entry per destination node (indices 1..N in distance_matrix).
    stops: list[StopNode]

    # Solver time limit in seconds
    time_limit_seconds: Optional[int] = 30

    # If True: use minimax (balance routes). If False: minimise total distance.
    balance_routes: Optional[bool] = True

class StopResult(BaseModel):
    location_index: int
    arrival_time_seconds: int

class RouteResult(BaseModel):
    vehicle_index: int
    stops: list[StopResult]
    total_duration_seconds: int
    total_weight_kg: float
    location_indices: list[int]

class SolveResponse(BaseModel):
    status: str  # SUCCESS | PARTIAL | INFEASIBLE
    routes: list[RouteResult]
    unassigned_location_indices: list[int]
    total_duration_seconds: int


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "vrp-solver-v2"}


# ── Solve ─────────────────────────────────────────────────────────────────────

@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest):
    n_locations = len(req.distance_matrix)
    n_vehicles = len(req.vehicles)
    n_stops = len(req.stops)

    if n_locations < 2:
        raise HTTPException(400, "distance_matrix needs at least 2 locations")
    if n_vehicles < 1:
        raise HTTPException(400, "vehicles list is empty")
    if n_stops != n_locations - 1:
        raise HTTPException(
            400,
            f"stops count ({n_stops}) must equal number of non-depot locations "
            f"({n_locations - 1})"
        )

    logger.info(
        f"Solving: {n_locations} locations, {n_vehicles} vehicles, "
        f"{n_stops} stops, balance={req.balance_routes}"
    )

    try:
        return _solve(req)
    except Exception as e:
        logger.error(f"Solver error: {e}", exc_info=True)
        raise HTTPException(500, f"Solver failed: {str(e)}")


def _solve(req: SolveRequest) -> SolveResponse:
    depot = 0
    n = len(req.distance_matrix)
    n_vehicles = len(req.vehicles)

    # ── 1. Routing index manager ──────────────────────────────────────────────
    manager = pywrapcp.RoutingIndexManager(n, n_vehicles, depot)
    routing = pywrapcp.RoutingModel(manager)

    # ── 2. Transit callback (travel time) ─────────────────────────────────────
    def transit_cb(from_idx, to_idx):
        return req.distance_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]

    transit_idx = routing.RegisterTransitCallback(transit_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    # ── 3. Time dimension (tracks cumulative time per vehicle) ────────────────
    max_horizon = max(v.shift_end for v in req.vehicles)
    routing.AddDimension(
        transit_idx,
        max_horizon,   # max slack (waiting time allowed at a node)
        max_horizon,   # max total time per vehicle
        False,         # don't force start cumul to zero (allows shift start offset)
        "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")

    # Apply driver shift windows at start/end nodes
    for v_idx, vehicle in enumerate(req.vehicles):
        start_idx = routing.Start(v_idx)
        end_idx   = routing.End(v_idx)
        time_dim.CumulVar(start_idx).SetRange(vehicle.shift_start, vehicle.shift_end)
        time_dim.CumulVar(end_idx).SetRange(vehicle.shift_start, vehicle.shift_end)

    # Apply stop time windows
    for stop in req.stops:
        if stop.time_window:
            node_idx = manager.NodeToIndex(stop.location_index)
            time_dim.CumulVar(node_idx).SetRange(
                stop.time_window.start,
                stop.time_window.end,
            )

    # ── 4. Weight capacity dimension ──────────────────────────────────────────
    # Build demand per node (depot = 0, destinations = package weight)
    demand_map: dict[int, int] = {0: 0}  # depot
    for stop in req.stops:
        demand_map[stop.location_index] = stop.demand_kg_x10

    def demand_cb(from_idx):
        node = manager.IndexToNode(from_idx)
        return demand_map.get(node, 0)

    demand_idx = routing.RegisterUnaryTransitCallback(demand_cb)
    routing.AddDimensionWithVehicleCapacity(
        demand_idx,
        0,  # no slack
        [v.capacity_kg_x10 for v in req.vehicles],
        True,
        "Capacity",
    )

    # ── 5. Minimax: penalise the longest route (balance workload) ─────────────
    if req.balance_routes:
        # SetGlobalSpanCostCoefficient adds a cost proportional to
        # (max_route_duration - min_route_duration) across all vehicles.
        # This pushes the solver to equalise route lengths.
        time_dim.SetGlobalSpanCostCoefficient(100)

    # ── 6. Minimum stops per vehicle (force distribution) ────────────────────
    # Each driver must visit at least 1 stop if there are enough stops.
    # We use a counter dimension: count = number of stops visited.
    def counter_cb(from_idx):
        node = manager.IndexToNode(from_idx)
        return 0 if node == depot else 1

    counter_transit_idx = routing.RegisterUnaryTransitCallback(counter_cb)
    routing.AddDimensionWithVehicleCapacity(
        counter_transit_idx,
        0,
        [n] * n_vehicles,  # max stops = total locations (no upper cap)
        True,
        "StopCount",
    )
    stop_count_dim = routing.GetDimensionOrDie("StopCount")

    # Force minimum 1 stop per driver (only if we have enough stops)
    min_stops = max(1, len(req.stops) // n_vehicles)
    if len(req.stops) >= n_vehicles:
        for v_idx in range(n_vehicles):
            # Get the actual index of the vehicle's final destination node
            end_node_index = routing.End(v_idx)
            # Apply hard lower bound: at least min_stops must be visited
            stop_count_dim.CumulVar(end_node_index).SetMin(min_stops)

    # ── 7. Drop penalty (expensive but not impossible to drop a stop) ─────────
    # This means the solver tries very hard to include every stop,
    # but can drop one if it's truly infeasible (e.g. overweight for all vehicles)
    penalty = 1_000_000
    for stop in req.stops:
        node_idx = manager.NodeToIndex(stop.location_index)
        routing.AddDisjunction([node_idx], penalty)

    # ── 8. Search parameters ──────────────────────────────────────────────────
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.seconds = req.time_limit_seconds

    # ── 9. Solve ──────────────────────────────────────────────────────────────
    solution = routing.SolveWithParameters(params)

    if solution is None:
        return SolveResponse(
            status="INFEASIBLE",
            routes=[],
            unassigned_location_indices=[s.location_index for s in req.stops],
            total_duration_seconds=0,
        )

    # ── 10. Extract solution ──────────────────────────────────────────────────
    routes: list[RouteResult] = []
    visited: set[int] = set()
    total_duration = 0

    cap_dim = routing.GetDimensionOrDie("Capacity")

    for v_idx in range(n_vehicles):
        index = routing.Start(v_idx)
        stops_out: list[StopResult] = []
        loc_indices: list[int] = []

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != depot:
                arrival = solution.Value(time_dim.CumulVar(index))
                stops_out.append(StopResult(
                    location_index=node,
                    arrival_time_seconds=arrival,
                ))
                loc_indices.append(node)
                visited.add(node)
            index = solution.Value(routing.NextVar(index))

        if stops_out:
            route_time = solution.Value(time_dim.CumulVar(routing.End(v_idx)))
            total_weight_x10 = solution.Value(cap_dim.CumulVar(routing.End(v_idx)))
            total_duration = max(total_duration, route_time)
            routes.append(RouteResult(
                vehicle_index=v_idx,
                stops=stops_out,
                total_duration_seconds=route_time,
                total_weight_kg=round(total_weight_x10 / WEIGHT_MULTIPLIER, 2),
                location_indices=loc_indices,
            ))

    unassigned = sorted(
        {s.location_index for s in req.stops} - visited
    )
    status = "SUCCESS" if not unassigned else "PARTIAL"

    return SolveResponse(
        status=status,
        routes=routes,
        unassigned_location_indices=unassigned,
        total_duration_seconds=total_duration,
    )