import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { BranchLogisticsStatus } from '../../common/enum/branch-logistics-status.enum';
import { DispatchReceiptStatus } from '../../common/enum/dispatch-receipt-status.enum';
import { DispatchReceiptStopStatus } from '../../common/enum/dispatch-receipt-stop-status.enum';
import { DriverAvailabilityStatus } from '../../common/enum/driver-availability-status.enum';
import { VehicleType } from '../../common/enum/package.enum';
import { Role } from '../../common/enum/role.enum';
import { VehicleOwnershipType } from '../../common/enum/vehicle-ownership-type.enum';
import { VehicleStatus } from '../../common/enum/vehicle-status.enum';
import { Coordinate, OsrmService } from '../../shared/osrm/osrm.service';
import {
  BranchLogisticsShipment,
  BranchLogisticsShipmentDocument,
} from '../../shared/schemas/branch-logistics-shipment.schema';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import {
  DispatchReceipt,
  DispatchReceiptDocument,
} from '../../shared/schemas/dispatch-receipt.schema';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentDocument,
} from '../../shared/schemas/driver-vehicle-assignment.schema';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { VehicleDocument } from '../../shared/schemas/vehicle.schema';
import { AutoPlanDispatchReceiptDto } from './dto/auto-plan-dispatch-receipt.dto';
import { DispatchReceiptService } from './dispatch-receipt.service';

const WEIGHT_MULTIPLIER = 10;
const DEFAULT_TRUCK_CAPACITY_KG: Record<string, number> = {
  [VehicleType.TRUCK]: 500,
  [VehicleType.TRUCK_LARGE]: 2000,
};

interface DestinationGroup {
  branch: BranchDocument;
  shipments: BranchLogisticsShipmentDocument[];
  totalWeightKg: number;
}

interface PlannerVehicle {
  driver: UserDocument;
  vehicle: VehicleDocument;
  maxWeightKg: number;
  maxPackageCount: number;
}

interface SolverStop {
  location_index: number;
  arrival_time_seconds: number;
}

interface SolverRoute {
  vehicle_index: number;
  stops: SolverStop[];
  total_duration_seconds: number;
  total_weight_kg: number;
  location_indices: number[];
}

interface SolverResult {
  status: 'SUCCESS' | 'PARTIAL' | 'INFEASIBLE';
  routes: SolverRoute[];
  unassigned_location_indices: number[];
}

@Injectable()
export class DispatchReceiptPlannerService {
  private readonly logger = new Logger(DispatchReceiptPlannerService.name);

  constructor(
    @InjectModel(DispatchReceipt.name)
    private readonly receiptModel: Model<DispatchReceiptDocument>,
    @InjectModel(BranchLogisticsShipment.name)
    private readonly shipmentModel: Model<BranchLogisticsShipmentDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(DriverVehicleAssignment.name)
    private readonly assignmentModel: Model<DriverVehicleAssignmentDocument>,
    private readonly config: ConfigService,
    private readonly osrmService: OsrmService,
    private readonly receiptService: DispatchReceiptService,
  ) {}

  async autoPlan(ownerId: string, dto: AutoPlanDispatchReceiptDto) {
    const sourceBranch = await this.branchModel.findOne({ ownerId }).exec();
    if (!sourceBranch) {
      throw new NotFoundException('No branch assigned to this branch owner.');
    }
    const sourceCoordinate = this.getCoordinate(sourceBranch);

    const shipmentFilter: Record<string, any> = {
      senderBranchId: sourceBranch._id,
      status: BranchLogisticsStatus.CREATED,
      dispatchReceiptId: null,
    };
    if (dto.shipmentIds?.length) {
      shipmentFilter._id = {
        $in: dto.shipmentIds.map((id) => new Types.ObjectId(id)),
      };
    }

    const shipments = await this.shipmentModel.find(shipmentFilter).exec();
    if (!shipments.length) {
      throw new BadRequestException(
        'No unassigned CREATED shipments are available at this branch.',
      );
    }
    if (dto.shipmentIds && shipments.length !== dto.shipmentIds.length) {
      throw new BadRequestException(
        'One or more selected shipments are unavailable or belong to another branch.',
      );
    }

    const destinationIds = [
      ...new Set(
        shipments.map((shipment) => shipment.receiverBranchId.toString()),
      ),
    ];
    const destinationBranches = await this.branchModel
      .find({
        _id: {
          $in: destinationIds.map((id) => new Types.ObjectId(id)),
        },
        isActive: true,
      })
      .exec();
    if (destinationBranches.length !== destinationIds.length) {
      throw new BadRequestException(
        'Every shipment must reference an active destination branch.',
      );
    }

    const branchById = new Map(
      destinationBranches.map((branch) => [branch._id.toString(), branch]),
    );
    const groups = destinationIds.map((destinationId): DestinationGroup => {
      const branch = branchById.get(destinationId)!;
      this.getCoordinate(branch);
      const destinationShipments = shipments.filter(
        (shipment) => shipment.receiverBranchId.toString() === destinationId,
      );
      return {
        branch,
        shipments: destinationShipments,
        totalWeightKg: destinationShipments.reduce(
          (sum, shipment) => sum + (shipment.weightKg ?? 0),
          0,
        ),
      };
    });

    const vehicles = await this.findAvailableTruckDrivers(
      sourceBranch._id.toString(),
    );
    if (!vehicles.length) {
      throw new BadRequestException(
        'No available branch driver has an active company truck assignment.',
      );
    }

    const locations = [sourceBranch, ...groups.map((group) => group.branch)];
    const coordinates = locations.map((branch) => this.getCoordinate(branch));
    const matrix = await this.osrmService.getDistanceMatrix(coordinates);

    // A line-haul receipt ends at its final destination. Zeroing the virtual
    // return leg makes the closed-route OR-Tools model optimize an open route.
    for (let index = 1; index < matrix.length; index += 1) {
      matrix[index][0] = 0;
    }

    const solverResult = await this.solve({
      distance_matrix: matrix,
      vehicles: vehicles.map((vehicle) => ({
        capacity_kg_x10: Math.round(vehicle.maxWeightKg * WEIGHT_MULTIPLIER),
        capacity_package_count: vehicle.maxPackageCount,
        shift_start: 0,
        shift_end: 86399,
      })),
      stops: groups.map((group, index) => ({
        location_index: index + 1,
        demand_kg_x10: Math.round(group.totalWeightKg * WEIGHT_MULTIPLIER),
        demand_package_count: group.shipments.length,
        time_window: null,
      })),
      time_limit_seconds: dto.timeLimitSeconds ?? 30,
      balance_routes: false,
      minimize_vehicle_count: true,
    });

    if (solverResult.status === 'INFEASIBLE' || !solverResult.routes.length) {
      throw new BadRequestException(
        'The available trucks cannot carry the current shipment load.',
      );
    }

    const createdReceipts: DispatchReceiptDocument[] = [];
    const assignedShipmentIds = new Set<string>();

    for (const route of solverResult.routes) {
      const vehicle = vehicles[route.vehicle_index];
      if (!vehicle || !route.stops.length) continue;

      const routeCoordinates: Coordinate[] = [
        sourceCoordinate,
        ...route.stops.map((stop) =>
          this.getCoordinate(locations[stop.location_index]),
        ),
      ];
      const routeDetails =
        await this.osrmService.getRouteDetails(routeCoordinates);
      if (!routeDetails) {
        throw new ServiceUnavailableException(
          'OSRM could not build a road-following route for the optimized stops.',
        );
      }

      const routeGroups = route.stops.map((stop) => ({
        stop,
        group: groups[stop.location_index - 1],
      }));
      const routeShipmentIds = routeGroups.flatMap(({ group }) =>
        group.shipments.map((shipment) => shipment._id),
      );
      const receipt = await this.receiptModel.create({
        receiptNumber: this.generateReceiptNumber(sourceBranch),
        sourceBranchId: sourceBranch._id,
        driverId: vehicle.driver._id,
        vehicleId: vehicle.vehicle._id,
        createdByUserId: new Types.ObjectId(ownerId),
        status: DispatchReceiptStatus.CREATED,
        planningMethod: 'OPTIMIZED',
        routeGeometry: null,
        routePoints: routeDetails.points,
        estimatedDurationSeconds:
          routeDetails.durationSeconds ?? route.total_duration_seconds,
        totalDistanceMeters: routeDetails.distanceMeters,
        totalWeightKg: route.total_weight_kg,
        simulationDurationSeconds: dto.simulationDurationSeconds ?? 120,
        stops: routeGroups.map(({ stop, group }, stopIndex) => ({
          stopOrder: stopIndex + 1,
          destinationBranchId: group.branch._id,
          shipmentIds: group.shipments.map((shipment) => shipment._id),
          status: DispatchReceiptStopStatus.PENDING,
          estimatedArrivalSeconds: stop.arrival_time_seconds,
          routeProgress: this.getRouteProgress(
            routeDetails.points,
            this.getCoordinate(group.branch),
          ),
        })),
        notes: dto.notes?.trim() || null,
      });

      const assignedAt = new Date();
      const updateResult = await this.shipmentModel.updateMany(
        {
          _id: { $in: routeShipmentIds },
          status: BranchLogisticsStatus.CREATED,
          dispatchReceiptId: null,
        },
        {
          $set: {
            assignedDriverId: vehicle.driver._id,
            assignedVehicleId: vehicle.vehicle._id,
            assignedAt,
            status: BranchLogisticsStatus.ASSIGNED,
            dispatchReceiptId: receipt._id,
          },
        },
      );

      if (updateResult.modifiedCount !== routeShipmentIds.length) {
        await this.receiptModel.deleteOne({ _id: receipt._id });
        throw new BadRequestException(
          'Some shipments were assigned by another request. Refresh and plan again.',
        );
      }

      await this.userModel.updateOne(
        { _id: vehicle.driver._id },
        { $set: { availabilityStatus: DriverAvailabilityStatus.ON_TRIP } },
      );
      routeShipmentIds.forEach((id) => assignedShipmentIds.add(id.toString()));
      createdReceipts.push(receipt);
    }

    const unassignedShipmentIds = shipments
      .map((shipment) => shipment._id.toString())
      .filter((id) => !assignedShipmentIds.has(id));
    const populatedReceipts = await Promise.all(
      createdReceipts.map((receipt) =>
        this.receiptService.getReceipt(ownerId, receipt._id.toString()),
      ),
    );

    this.logger.log(
      `Planned ${populatedReceipts.length} receipt(s) for ${assignedShipmentIds.size}/${shipments.length} shipments at ${sourceBranch.name}.`,
    );

    return {
      status: unassignedShipmentIds.length ? 'PARTIAL' : 'SUCCESS',
      receipts: populatedReceipts,
      summary: {
        totalShipments: shipments.length,
        assignedShipments: assignedShipmentIds.size,
        unassignedShipments: unassignedShipmentIds.length,
        availableTruckDrivers: vehicles.length,
        trucksUsed: populatedReceipts.length,
      },
      unassignedShipmentIds,
    };
  }

  private async findAvailableTruckDrivers(
    sourceBranchId: string,
  ): Promise<PlannerVehicle[]> {
    const drivers = await this.userModel
      .find({
        branchId: new Types.ObjectId(sourceBranchId),
        role: Role.DRIVER,
        isActive: true,
        availabilityStatus: DriverAvailabilityStatus.AVAILABLE,
      })
      .exec();
    if (!drivers.length) return [];

    const driverById = new Map(
      drivers.map((driver) => [driver._id.toString(), driver]),
    );
    const assignments = await this.assignmentModel
      .find({
        driverId: { $in: drivers.map((driver) => driver._id) },
        isActive: true,
      })
      .populate('vehicleId')
      .exec();

    return assignments
      .map((assignment): PlannerVehicle | null => {
        const driver = driverById.get(assignment.driverId.toString());
        const vehicle =
          assignment.vehicleId as unknown as VehicleDocument | null;
        if (!driver || !vehicle) return null;
        if (
          vehicle.type !== VehicleType.TRUCK &&
          vehicle.type !== VehicleType.TRUCK_LARGE
        ) {
          return null;
        }
        if (
          vehicle.ownershipType !== VehicleOwnershipType.COMPANY ||
          vehicle.branchId?.toString() !== sourceBranchId ||
          !vehicle.isActive ||
          (vehicle.status !== VehicleStatus.IN_USE &&
            vehicle.status !== VehicleStatus.AVAILABLE)
        ) {
          return null;
        }

        return {
          driver,
          vehicle,
          maxWeightKg:
            vehicle.maxWeightKg ??
            driver.maxLoadWeightKg ??
            DEFAULT_TRUCK_CAPACITY_KG[vehicle.type],
          maxPackageCount:
            vehicle.maxPackageCount ?? driver.maxPackageCount ?? 100,
        };
      })
      .filter((candidate): candidate is PlannerVehicle => candidate != null)
      .sort((left, right) => right.maxWeightKg - left.maxWeightKg);
  }

  private async solve(payload: Record<string, unknown>) {
    const solverUrl = this.config.get<string>('solver.url');
    if (!solverUrl) {
      throw new ServiceUnavailableException('Solver URL is not configured.');
    }

    try {
      const { data } = await axios.post<SolverResult>(
        `${solverUrl}/solve`,
        payload,
        { timeout: 135_000 },
      );
      return data;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown solver error';
      this.logger.error(`Dispatch receipt solver failed: ${message}`);
      throw new ServiceUnavailableException(
        'The route optimization service is unavailable.',
      );
    }
  }

  private getCoordinate(branch: BranchDocument): Coordinate {
    const latitude = branch.latitude ?? branch.location?.lat;
    const longitude = branch.longitude ?? branch.location?.lng;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException(
        `Branch "${branch.name}" does not have valid coordinates.`,
      );
    }
    return { latitude, longitude };
  }

  private getRouteProgress(
    points: Coordinate[],
    destination: Coordinate,
  ): number {
    if (points.length < 2) return 1;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const segmentDistances: number[] = [];
    let totalDistance = 0;

    for (let index = 0; index < points.length; index += 1) {
      const distanceToDestination = this.distanceMeters(
        points[index],
        destination,
      );
      if (distanceToDestination < nearestDistance) {
        nearestDistance = distanceToDestination;
        nearestIndex = index;
      }
      if (index < points.length - 1) {
        const segmentDistance = this.distanceMeters(
          points[index],
          points[index + 1],
        );
        segmentDistances.push(segmentDistance);
        totalDistance += segmentDistance;
      }
    }

    if (totalDistance <= 0) return 1;
    const distanceToStop = segmentDistances
      .slice(0, nearestIndex)
      .reduce((sum, distance) => sum + distance, 0);
    return Math.min(1, Math.max(0.05, distanceToStop / totalDistance));
  }

  private distanceMeters(from: Coordinate, to: Coordinate): number {
    const earthRadiusMeters = 6_371_000;
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = toRadians(to.latitude - from.latitude);
    const longitudeDelta = toRadians(to.longitude - from.longitude);
    const fromLatitude = toRadians(from.latitude);
    const toLatitude = toRadians(to.latitude);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromLatitude) *
        Math.cos(toLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;
    return (
      2 *
      earthRadiusMeters *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
  }

  private generateReceiptNumber(branch: BranchDocument): string {
    const code = (branch.code ?? `B${branch.branchNumber ?? 1}`)
      .toUpperCase()
      .replace(/\s+/g, '');
    const now = new Date();
    const date = `${String(now.getFullYear()).slice(-2)}${String(
      now.getMonth() + 1,
    ).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `DR-${code}-${date}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }
}
