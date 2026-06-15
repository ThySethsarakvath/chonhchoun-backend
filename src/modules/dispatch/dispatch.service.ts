import {
  Injectable,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import axios from 'axios';

import { OsrmService } from '../../shared/osrm/osrm.service';
import { BranchesService } from '../branches/branches.service';
import { PackagesService } from '../packages/packages.service';
import { DriversService } from '../drivers/drivers.service';
import { DeliveriesService } from '../deliveries/deliveries.service';

import { Delivery, DeliveryDocument } from '../../shared/schemas/delivery.schema';
import {
  WarehousePackage,
  WarehousePackageDocument,
  PackagePriority,
} from '../../shared/schemas/warehouse-package.schema';
import { Driver, DriverDocument, VEHICLE_CAPACITY_KG, VehicleType } from '../../shared/schemas/driver.schema';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import { DispatchDto } from './dto/dispatch.dto';

// ── Priority → time window mapping (seconds from midnight) ───────────────────
const PRIORITY_WINDOWS: Record<PackagePriority, { start: number; end: number }> = {
  [PackagePriority.URGENT]:   { start: 0,     end: 28800  }, // must arrive by 08:00
  [PackagePriority.STANDARD]: { start: 0,     end: 57600  }, // by 16:00
  [PackagePriority.LOW]:      { start: 0,     end: 86399  }, // any time
};

const WEIGHT_MULTIPLIER = 10; // keep one decimal place as integer

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectModel(Delivery.name)          private readonly deliveryModel:  Model<DeliveryDocument>,
    @InjectModel(WarehousePackage.name)  private readonly pkgModel:        Model<WarehousePackageDocument>,
    @InjectModel(Driver.name)            private readonly driverModel:     Model<DriverDocument>,
    @InjectModel(Branch.name)            private readonly branchModel:     Model<BranchDocument>,
    private readonly osrmService:        OsrmService,
    private readonly branchesService:    BranchesService,
    private readonly packagesService:    PackagesService,
    private readonly driversService:     DriversService,
    private readonly deliveriesService:  DeliveriesService,
    private readonly config:             ConfigService,
  ) {}

  async dispatch(dto: DispatchDto): Promise<DeliveryDocument> {

    // ── 1. Load source branch ─────────────────────────────────────────────────
    const sourceBranch = await this.branchesService.findOne(dto.sourceBranchId);

    // ── 2. Load and validate drivers ──────────────────────────────────────────
    const drivers = await this.driverModel
      .find({
        _id:      { $in: dto.driverIds.map(id => new Types.ObjectId(id)) },
        isActive: true,
        status:   'AVAILABLE',
      })
      .exec();

    if (drivers.length !== dto.driverIds.length) {
      throw new BadRequestException(
        'One or more drivers are invalid, inactive, or not AVAILABLE',
      );
    }

    // ── 3. Load packages ──────────────────────────────────────────────────────
    let packages: WarehousePackageDocument[];
    if (dto.packageIds?.length) {
      packages = await this.pkgModel.find({
        _id:            { $in: dto.packageIds.map(id => new Types.ObjectId(id)) },
        sourceBranchId: new Types.ObjectId(dto.sourceBranchId),
        status:         'PENDING',
      }).exec();
      if (packages.length !== dto.packageIds.length) {
        throw new BadRequestException('Some packages are not PENDING or not at this branch');
      }
    } else {
      packages = await this.pkgModel.find({
        sourceBranchId: new Types.ObjectId(dto.sourceBranchId),
        status:         'PENDING',
      }).exec();
    }

    if (!packages.length) {
      throw new BadRequestException('No PENDING packages to dispatch');
    }

    // ── 4. Aggregate packages by destination branch ───────────────────────────
    // destMap[branchId] = { totalWeightKg, highestPriority, packageList }
    const destMap = new Map<string, {
      totalWeightKg:   number;
      highestPriority: PackagePriority;
      packages:        WarehousePackageDocument[];
    }>();

    for (const pkg of packages) {
      const destId = pkg.destinationBranchId.toString();
      if (!destMap.has(destId)) {
        destMap.set(destId, {
          totalWeightKg:   0,
          highestPriority: PackagePriority.LOW,
          packages:        [],
        });
      }
      const entry = destMap.get(destId)!;
      entry.totalWeightKg   += pkg.weightKg;
      entry.packages.push(pkg);

      // Highest priority wins (URGENT > STANDARD > LOW)
      const rank = { URGENT: 2, STANDARD: 1, LOW: 0 };
      if (rank[pkg.priority] > rank[entry.highestPriority]) {
        entry.highestPriority = pkg.priority;
      }
    }

    // ── 5. Load destination branches ──────────────────────────────────────────
    const destBranchIds = [...destMap.keys()];
    const destBranches  = await this.branchModel.find({
      _id: { $in: destBranchIds.map(id => new Types.ObjectId(id)) },
    }).exec();

    if (!destBranches.length) {
      throw new BadRequestException('No destination branches found');
    }

    // ── 6. Pre-filter: remove drivers whose vehicle can't handle any stop ─────
    // A driver is eligible if their vehicle capacity ≥ at least one destination's weight.
    // This prevents sending a motorcycle to deliver 200 kg of goods.
    const maxSingleStopWeight = Math.max(...[...destMap.values()].map(d => d.totalWeightKg));
    const eligibleDrivers = drivers.filter(d => {
      const cap = VEHICLE_CAPACITY_KG[d.vehicleType as VehicleType];
      return cap >= Math.min(...[...destMap.values()].map(e => e.totalWeightKg));
    });

    if (!eligibleDrivers.length) {
      throw new BadRequestException(
        `No driver vehicle is capable of carrying even the lightest stop ` +
        `(min stop weight: ${Math.min(...[...destMap.values()].map(e => e.totalWeightKg))} kg). ` +
        `Assign heavier-capacity vehicles.`,
      );
    }

    if (eligibleDrivers.length < drivers.length) {
      this.logger.warn(
        `${drivers.length - eligibleDrivers.length} driver(s) excluded: vehicle too small`,
      );
    }

    // ── 7. Build location list: [depot, ...destinations] ─────────────────────
    // Index 0 = source warehouse (depot)
    // Index 1..N = destination branches
    const locations: BranchDocument[] = [sourceBranch, ...destBranches];
    const branchIndexMap = new Map<string, number>();
    destBranches.forEach((b, i) => branchIndexMap.set(b._id.toString(), i + 1));

    this.logger.log(
      `Dispatch: ${packages.length} pkgs → ${destBranches.length} destinations, ` +
      `${eligibleDrivers.length} eligible drivers`,
    );

    // ── 8. OSRM distance matrix ───────────────────────────────────────────────
    const distanceMatrix = await this.osrmService.getDistanceMatrix(
      locations.map(l => ({ latitude: l.latitude, longitude: l.longitude })),
    );

    // ── 9. Build enriched solver payload ──────────────────────────────────────

    // Vehicle specs — one per eligible driver
    const vehicleSpecs = eligibleDrivers.map(d => ({
      capacity_kg_x10: Math.round(VEHICLE_CAPACITY_KG[d.vehicleType as VehicleType] * WEIGHT_MULTIPLIER),
      shift_start:     d.shiftStart ?? 0,
      shift_end:       d.shiftEnd   ?? 86399,
    }));

    // Stop nodes — one per destination branch
    const stopNodes = destBranches.map((branch, i) => {
      const destId  = branch._id.toString();
      const entry   = destMap.get(destId)!;
      const locIdx  = i + 1; // 0 is depot
      const tw      = dto.useTimeWindows
        ? PRIORITY_WINDOWS[entry.highestPriority]
        : null;

      return {
        location_index:  locIdx,
        demand_kg_x10:   Math.round(entry.totalWeightKg * WEIGHT_MULTIPLIER),
        time_window:     tw,
      };
    });

    const solverPayload = {
      distance_matrix:    distanceMatrix,
      vehicles:           vehicleSpecs,
      stops:              stopNodes,
      time_limit_seconds: dto.timeLimitSeconds ?? 30,
      balance_routes:     true,  // always on — forces workload equalisation
    };

    // ── 10. Call Python solver ────────────────────────────────────────────────
    const solverUrl = this.config.get<string>('solver.url')!;
    let solverResult: any;
    try {
      this.logger.log(`[Solver] Sending request to ${solverUrl}/solve`);
      this.logger.debug(`[Solver] Payload: ${JSON.stringify(solverPayload, null, 2)}`);
      
      const { data } = await axios.post(`${solverUrl}/solve`, solverPayload, {
        timeout: (dto.timeLimitSeconds ?? 30) * 1000 + 15_000,
      });
      solverResult = data;
      this.logger.log(`[Solver] Success: ${JSON.stringify(solverResult)}`);
    } catch (err: any) {
      this.logger.error(`[Solver] Request failed`);
      this.logger.error(`[Solver] Error message: ${err.message}`);
      if (err.response) {
        this.logger.error(`[Solver] Status code: ${err.response.status}`);
        this.logger.error(`[Solver] Response: ${JSON.stringify(err.response.data)}`);
      } else if (err.request) {
        this.logger.error(`[Solver] No response received from server`);
      } else {
        this.logger.error(`[Solver] Request setup error: ${err.message}`);
      }
      throw new ServiceUnavailableException(
        `VRP solver unavailable at ${solverUrl}/solve: ${err.message}`
      );
    }

    if (solverResult.status === 'INFEASIBLE') {
      throw new BadRequestException(
        'VRP solver could not find any feasible routes. ' +
        'Check vehicle capacities vs package weights and driver shift windows.',
      );
    }

    this.logger.log(
      `Solver: ${solverResult.status}, ${solverResult.routes.length} routes, ` +
      `unassigned: ${solverResult.unassigned_location_indices?.length ?? 0}`,
    );

    // ── 11. Fetch route geometry per driver (parallel) ────────────────────────
    const geometries: (string | null)[] = await Promise.all(
      solverResult.routes.map(async (route: any) => {
        const coords = [
          { latitude: sourceBranch.latitude, longitude: sourceBranch.longitude },
          ...route.location_indices.map((idx: number) => ({
            latitude:  locations[idx].latitude,
            longitude: locations[idx].longitude,
          })),
        ];
        return this.osrmService.getRouteGeometry(coords);
      }),
    );

    // ── 12. Map packages to their stop's driver ───────────────────────────────
    const packagesByDestIdx = new Map<number, WarehousePackageDocument[]>();
    for (const pkg of packages) {
      const idx = branchIndexMap.get(pkg.destinationBranchId.toString());
      if (idx === undefined) continue;
      if (!packagesByDestIdx.has(idx)) packagesByDestIdx.set(idx, []);
      packagesByDestIdx.get(idx)!.push(pkg);
    }

    // ── 13. Build delivery routes ─────────────────────────────────────────────
    const deliveryRoutes = solverResult.routes.map((route: any, rIdx: number) => {
      const driver = eligibleDrivers[route.vehicle_index];
      const stops  = route.stops.map((stop: any, sIdx: number) => ({
        branchId:                 locations[stop.location_index]._id,
        stopOrder:                sIdx + 1,
        estimatedArrivalSeconds:  stop.arrival_time_seconds,
        packageIds:               (packagesByDestIdx.get(stop.location_index) ?? []).map(p => p._id),
      }));

      return {
        driverId:             driver._id,
        stops,
        totalDurationSeconds: route.total_duration_seconds,
        totalWeightKg:        route.total_weight_kg,
        routeGeometry:        geometries[rIdx] ?? null,
        isCompleted:          false,
      };
    });

    // ── 14. Persist delivery ──────────────────────────────────────────────────
    const delivery = await this.deliveryModel.create({
      sourceBranchId:              sourceBranch._id,
      status:                      'PLANNED',
      routes:                      deliveryRoutes,
      packageIds:                  packages.map(p => p._id),
      totalPackages:               packages.length,
      totalDrivers:                eligibleDrivers.length,
      unassignedLocationIndices:   solverResult.unassigned_location_indices ?? [],
    });

    // ── 15. Mark packages ASSIGNED, drivers ON_DELIVERY ───────────────────────
    await this.packagesService.markAssigned(
      packages.map(p => p._id.toString()),
      delivery._id.toString(),
    );
    await this.driversService.markOnDelivery(
      eligibleDrivers.map(d => d._id.toString()),
    );

    this.logger.log(`Delivery ${delivery._id} created successfully`);
    return delivery;
  }
}