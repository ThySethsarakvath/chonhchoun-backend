import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DispatchReceiptStatus } from '../../common/enum/dispatch-receipt-status.enum';
import { DispatchReceiptStopStatus } from '../../common/enum/dispatch-receipt-stop-status.enum';
import { BranchLogisticsStatus } from '../../common/enum/branch-logistics-status.enum';
import { DriverAvailabilityStatus } from '../../common/enum/driver-availability-status.enum';
import { Role } from '../../common/enum/role.enum';
import { VehicleOwnershipType } from '../../common/enum/vehicle-ownership-type.enum';
import {
  DispatchReceipt,
  DispatchReceiptDocument,
} from '../../shared/schemas/dispatch-receipt.schema';
import {
  BranchLogisticsShipment,
  BranchLogisticsShipmentDocument,
} from '../../shared/schemas/branch-logistics-shipment.schema';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentDocument,
} from '../../shared/schemas/driver-vehicle-assignment.schema';
import { CreateDispatchReceiptDto } from './dto/create-dispatch-receipt.dto';
import { ConfirmStopReceiptDto } from './dto/confirm-stop-receipt.dto';
import { QueryDispatchReceiptsDto } from './dto/query-dispatch-receipts.dto';

@Injectable()
export class DispatchReceiptService {
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
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async getBranchForOwner(ownerId: string) {
    const branch = await this.branchModel.findOne({ ownerId }).exec();
    if (!branch) {
      throw new NotFoundException('No branch assigned to this branch owner.');
    }
    return branch;
  }

  private async populateReceipt<T>(docs: T): Promise<T> {
    return this.receiptModel.populate(docs, [
      {
        path: 'sourceBranchId',
        select: 'name branchNumber code address location latitude longitude',
      },
      {
        path: 'driverId',
        select: 'name phone availabilityStatus',
      },
      {
        path: 'vehicleId',
        select: 'code plateNumber type maxWeightKg maxPackageCount status',
      },
      {
        path: 'stops.destinationBranchId',
        select: 'name branchNumber code address location latitude longitude',
      },
      {
        path: 'stops.shipmentIds',
        select:
          'ticketNumber itemDescription weightKg status sender receiver senderBranchId receiverBranchId totalPrice',
      },
      {
        path: 'stops.missingShipmentIds',
        select: 'ticketNumber itemDescription',
      },
      {
        path: 'stops.damagedShipmentIds',
        select: 'ticketNumber itemDescription',
      },
      {
        path: 'stops.confirmedByUserId',
        select: 'name phone',
      },
      {
        path: 'createdByUserId',
        select: 'name phone',
      },
    ]) as Promise<T>;
  }

  private generateReceiptNumber(branch: BranchDocument): string {
    const code = (branch.code ?? `B${branch.branchNumber ?? 1}`)
      .toUpperCase()
      .replace(/\s+/g, '');
    const now = new Date();
    const date = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const seq = Date.now().toString().slice(-6);
    return `DR-${code}-${date}-${seq}`;
  }

  private getStopProgress(
    receipt: DispatchReceiptDocument,
    stopOrder: number,
  ): number {
    const orderedStops = [...receipt.stops].sort(
      (left, right) => left.stopOrder - right.stopOrder,
    );
    const stopIndex = orderedStops.findIndex(
      (stop) => stop.stopOrder === stopOrder,
    );
    if (stopIndex < 0) return 0;

    const routeProgress = orderedStops[stopIndex].routeProgress;
    if (typeof routeProgress === 'number') {
      return Math.min(1, Math.max(0.05, routeProgress));
    }

    const estimatedArrival = orderedStops[stopIndex].estimatedArrivalSeconds;
    const totalDuration = receipt.estimatedDurationSeconds;
    const progress =
      typeof estimatedArrival === 'number' &&
      typeof totalDuration === 'number' &&
      totalDuration > 0
        ? estimatedArrival / totalDuration
        : (stopIndex + 1) / orderedStops.length;
    return Math.min(1, Math.max(0.05, progress));
  }

  private async markStopArrived(
    receipt: DispatchReceiptDocument,
    stopOrder: number,
  ) {
    const stop = receipt.stops.find(
      (candidate) => candidate.stopOrder === stopOrder,
    );
    if (!stop || stop.status !== DispatchReceiptStopStatus.PENDING) {
      return;
    }

    stop.status = DispatchReceiptStopStatus.ARRIVED;
    stop.arrivedAt = new Date();
    receipt.simulationProgress = this.getStopProgress(receipt, stopOrder);
    receipt.simulationSegmentStartedAt = null;
    await receipt.save();

    await this.shipmentModel.updateMany(
      { _id: { $in: stop.shipmentIds } },
      {
        $set: {
          status: BranchLogisticsStatus.RECEIVED_AT_RECEIVER_WAREHOUSE,
          receivedAtReceiverWarehouseAt: stop.arrivedAt,
        },
      },
    );
  }

  private scopeReceiptForDestination(
    populatedReceipt: any,
    destinationBranchId: string,
  ) {
    const receipt =
      typeof populatedReceipt?.toObject === 'function'
        ? populatedReceipt.toObject()
        : populatedReceipt;
    const referenceId = (value: any) =>
      (value?._id ?? value)?.toString?.() ?? '';
    const destinationStops = (receipt.stops ?? []).filter(
      (stop: any) =>
        referenceId(stop.destinationBranchId) === destinationBranchId,
    );
    if (!destinationStops.length) return receipt;

    const ownStop = destinationStops[0];
    const totalDuration = Number(receipt.estimatedDurationSeconds ?? 0);
    const estimatedArrival = Number(ownStop.estimatedArrivalSeconds ?? 0);
    const storedRouteProgress = Number(ownStop.routeProgress ?? 0);
    const viewerRouteEndProgress =
      storedRouteProgress > 0
        ? Math.min(1, Math.max(0.05, storedRouteProgress))
        : totalDuration > 0
          ? Math.min(1, Math.max(0.05, estimatedArrival / totalDuration))
          : Math.min(
              1,
              Math.max(
                0.05,
                Number(ownStop.stopOrder ?? 1) /
                  Math.max(1, Number(receipt.stops?.length ?? 1)),
              ),
            );

    const destination = ownStop.destinationBranchId;
    const destinationLatitude =
      destination?.latitude ?? destination?.location?.lat;
    const destinationLongitude =
      destination?.longitude ?? destination?.location?.lng;
    const routePoints = Array.isArray(receipt.routePoints)
      ? receipt.routePoints
      : [];
    let scopedRoutePoints = routePoints;

    if (
      routePoints.length >= 2 &&
      typeof destinationLatitude === 'number' &&
      typeof destinationLongitude === 'number'
    ) {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      routePoints.forEach((point: any, index: number) => {
        const latitudeDifference = Number(point.latitude) - destinationLatitude;
        const longitudeDifference =
          Number(point.longitude) - destinationLongitude;
        const distance =
          latitudeDifference * latitudeDifference +
          longitudeDifference * longitudeDifference;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      scopedRoutePoints = routePoints.slice(0, nearestIndex + 1);
    }

    const ownWeight = (ownStop.shipmentIds ?? []).reduce(
      (sum: number, shipment: any) => sum + Number(shipment?.weightKg ?? 0),
      0,
    );

    return {
      ...receipt,
      stops: destinationStops,
      routeGeometry: null,
      routePoints: scopedRoutePoints,
      estimatedDurationSeconds:
        estimatedArrival > 0
          ? estimatedArrival
          : receipt.estimatedDurationSeconds,
      totalDistanceMeters:
        typeof receipt.totalDistanceMeters === 'number'
          ? Math.round(receipt.totalDistanceMeters * viewerRouteEndProgress)
          : null,
      totalWeightKg: ownWeight,
      viewerRouteEndProgress,
    };
  }

  // ── Create Dispatch Receipt ──────────────────────────────────────────────

  async createReceipt(ownerId: string, dto: CreateDispatchReceiptDto) {
    const sourceBranch = await this.getBranchForOwner(ownerId);

    // Validate driver belongs to source branch and is available
    const driver = await this.userModel.findById(dto.driverId).exec();
    if (!driver || driver.role !== Role.DRIVER) {
      throw new NotFoundException('Driver not found.');
    }
    if (driver.branchId?.toString() !== sourceBranch._id.toString()) {
      throw new BadRequestException(
        'This driver does not belong to your branch.',
      );
    }
    if (driver.availabilityStatus !== DriverAvailabilityStatus.AVAILABLE) {
      throw new BadRequestException(
        'Only available branch drivers can be assigned to a dispatch receipt.',
      );
    }

    // Resolve driver's active vehicle assignment
    const activeAssignment = await this.assignmentModel
      .findOne({ driverId: driver._id, isActive: true })
      .populate('vehicleId')
      .exec();

    if (!activeAssignment || !activeAssignment.vehicleId) {
      throw new BadRequestException(
        'Assign a branch vehicle to this driver first.',
      );
    }
    const vehicle = activeAssignment.vehicleId as any;
    if (vehicle.branchId?.toString() !== sourceBranch._id.toString()) {
      throw new BadRequestException(
        'Assigned vehicle does not belong to your branch.',
      );
    }
    if (vehicle.ownershipType !== VehicleOwnershipType.COMPANY) {
      throw new BadRequestException(
        'Only company-owned vehicles can be used for dispatch receipts.',
      );
    }

    // Validate stops: unique stop orders, unique destination branches
    const stopOrders = dto.stops.map((s) => s.stopOrder);
    if (new Set(stopOrders).size !== stopOrders.length) {
      throw new BadRequestException('Stop orders must be unique.');
    }
    const destBranchIds = dto.stops.map((s) => s.destinationBranchId);
    if (new Set(destBranchIds).size !== destBranchIds.length) {
      throw new BadRequestException(
        'Each stop must have a different destination branch.',
      );
    }

    // Collect and deduplicate all shipment IDs across all stops
    const allShipmentIds: string[] = [];
    for (const stop of dto.stops) {
      allShipmentIds.push(...stop.shipmentIds);
    }
    const uniqueShipmentIds = [...new Set(allShipmentIds)];
    if (uniqueShipmentIds.length !== allShipmentIds.length) {
      throw new BadRequestException(
        'A shipment cannot appear in more than one stop.',
      );
    }

    // Fetch and validate all shipments
    const shipments = await this.shipmentModel
      .find({
        _id: {
          $in: uniqueShipmentIds.map((id) => new Types.ObjectId(id)),
        },
      })
      .exec();

    if (shipments.length !== uniqueShipmentIds.length) {
      throw new NotFoundException('One or more shipments were not found.');
    }

    const shipmentMap = new Map(shipments.map((s) => [s._id.toString(), s]));

    // Validate each stop
    for (const stopDto of dto.stops) {
      const destBranch = await this.branchModel
        .findById(stopDto.destinationBranchId)
        .exec();
      if (!destBranch || !destBranch.isActive) {
        throw new NotFoundException(
          `Destination branch for stop ${stopDto.stopOrder} not found.`,
        );
      }
      if (destBranch._id.toString() === sourceBranch._id.toString()) {
        throw new BadRequestException(
          `Stop ${stopDto.stopOrder} destination cannot be the same as source branch.`,
        );
      }

      for (const shipmentId of stopDto.shipmentIds) {
        const shipment = shipmentMap.get(shipmentId);
        if (!shipment) continue;

        if (
          shipment.senderBranchId?.toString() !== sourceBranch._id.toString()
        ) {
          throw new BadRequestException(
            `Shipment ${shipment.ticketNumber} does not originate from your branch.`,
          );
        }
        if (
          shipment.receiverBranchId?.toString() !== destBranch._id.toString()
        ) {
          throw new BadRequestException(
            `Shipment ${shipment.ticketNumber} receiver branch does not match stop ${stopDto.stopOrder} destination.`,
          );
        }
        if (
          shipment.status !== BranchLogisticsStatus.CREATED &&
          shipment.status !== BranchLogisticsStatus.ASSIGNED
        ) {
          throw new BadRequestException(
            `Shipment ${shipment.ticketNumber} is not in a valid state for dispatch (current: ${shipment.status}).`,
          );
        }
        if (shipment.dispatchReceiptId) {
          throw new BadRequestException(
            `Shipment ${shipment.ticketNumber} is already part of another dispatch receipt.`,
          );
        }
      }
    }

    // Create the receipt
    const receipt = await this.receiptModel.create({
      receiptNumber: this.generateReceiptNumber(sourceBranch),
      sourceBranchId: sourceBranch._id,
      driverId: driver._id,
      vehicleId: vehicle._id,
      createdByUserId: new Types.ObjectId(ownerId),
      status: DispatchReceiptStatus.CREATED,
      planningMethod: 'MANUAL',
      totalWeightKg: shipments.reduce(
        (sum, shipment) => sum + (shipment.weightKg ?? 0),
        0,
      ),
      stops: dto.stops
        .sort((a, b) => a.stopOrder - b.stopOrder)
        .map((stop) => ({
          stopOrder: stop.stopOrder,
          destinationBranchId: new Types.ObjectId(stop.destinationBranchId),
          shipmentIds: stop.shipmentIds.map((id) => new Types.ObjectId(id)),
          status: DispatchReceiptStopStatus.PENDING,
        })),
      notes: dto.notes?.trim() || null,
    });

    // Update all shipments: assign driver/vehicle and link to receipt
    const assignedAt = new Date();
    await this.shipmentModel.updateMany(
      { _id: { $in: uniqueShipmentIds.map((id) => new Types.ObjectId(id)) } },
      {
        $set: {
          assignedDriverId: driver._id,
          assignedVehicleId: vehicle._id,
          assignedAt,
          status: BranchLogisticsStatus.ASSIGNED,
          dispatchReceiptId: receipt._id,
        },
      },
    );

    await this.userModel.updateOne(
      { _id: driver._id },
      {
        $set: {
          availabilityStatus: DriverAvailabilityStatus.ON_TRIP,
        },
      },
    );

    return this.populateReceipt(
      await this.receiptModel.findById(receipt._id).exec(),
    );
  }

  // ── Depart ───────────────────────────────────────────────────────────────

  async departReceipt(ownerId: string, receiptId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const receipt = await this.receiptModel.findById(receiptId).exec();
    if (!receipt) {
      throw new NotFoundException('Dispatch receipt not found.');
    }
    if (receipt.sourceBranchId.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This dispatch receipt does not belong to your branch.',
      );
    }
    if (receipt.status !== DispatchReceiptStatus.CREATED) {
      throw new BadRequestException(
        'Only receipts in CREATED status can depart.',
      );
    }

    receipt.status = DispatchReceiptStatus.IN_TRANSIT;
    receipt.departedAt = new Date();
    await receipt.save();

    // Update all included shipments to IN_TRANSIT
    const allShipmentIds = receipt.stops.flatMap((s) => s.shipmentIds);
    await this.shipmentModel.updateMany(
      { _id: { $in: allShipmentIds } },
      {
        $set: {
          status: BranchLogisticsStatus.IN_TRANSIT,
          inTransitAt: receipt.departedAt,
        },
      },
    );

    return this.populateReceipt(receipt);
  }

  async startSimulation(ownerId: string, receiptId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const receipt = await this.receiptModel.findById(receiptId).exec();
    if (!receipt) {
      throw new NotFoundException('Dispatch receipt not found.');
    }
    if (receipt.sourceBranchId.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'Only the source branch can start this simulation.',
      );
    }
    if (receipt.status !== DispatchReceiptStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'The receipt must depart before its simulation can start.',
      );
    }
    const hasRoute =
      !!receipt.routeGeometry || (receipt.routePoints?.length ?? 0) >= 2;
    if (receipt.planningMethod !== 'OPTIMIZED' || !hasRoute) {
      throw new BadRequestException(
        'Route simulation is available only for optimized receipts.',
      );
    }

    if (!receipt.simulationStartedAt) {
      const now = new Date();
      receipt.simulationStartedAt = now;
      receipt.simulationProgress = 0;
      receipt.simulationSegmentStartedAt = now;
      await receipt.save();
    }
    return this.populateReceipt(receipt);
  }

  // ── Simulate Arrival at Stop ─────────────────────────────────────────────

  async syncSimulation(ownerId: string, receiptId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const receipt = await this.receiptModel.findById(receiptId).exec();
    if (!receipt) {
      throw new NotFoundException('Dispatch receipt not found.');
    }

    const isSource =
      receipt.sourceBranchId.toString() === branch._id.toString();
    const isDestination = receipt.stops.some(
      (stop) => stop.destinationBranchId.toString() === branch._id.toString(),
    );
    if (!isSource && !isDestination) {
      throw new BadRequestException(
        'This dispatch receipt does not involve your branch.',
      );
    }

    if (
      receipt.status === DispatchReceiptStatus.IN_TRANSIT &&
      receipt.simulationSegmentStartedAt
    ) {
      const nextStop = [...receipt.stops]
        .sort((left, right) => left.stopOrder - right.stopOrder)
        .find((stop) => stop.status === DispatchReceiptStopStatus.PENDING);
      if (nextStop) {
        const elapsedSeconds = Math.max(
          0,
          (Date.now() - receipt.simulationSegmentStartedAt.getTime()) / 1000,
        );
        const simulatedProgress =
          (receipt.simulationProgress ?? 0) +
          elapsedSeconds /
            Math.max(1, receipt.simulationDurationSeconds ?? 120);
        const stopProgress = this.getStopProgress(receipt, nextStop.stopOrder);
        if (simulatedProgress >= stopProgress) {
          await this.markStopArrived(receipt, nextStop.stopOrder);
        }
      }
    }

    const populated = await this.populateReceipt(receipt);
    return isSource
      ? populated
      : this.scopeReceiptForDestination(populated, branch._id.toString());
  }

  async simulateArrivalAtStop(
    ownerId: string,
    receiptId: string,
    stopOrder: number,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const receipt = await this.receiptModel.findById(receiptId).exec();
    if (!receipt) {
      throw new NotFoundException('Dispatch receipt not found.');
    }
    if (receipt.sourceBranchId.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This dispatch receipt does not belong to your branch.',
      );
    }
    if (receipt.status !== DispatchReceiptStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'Receipt must be IN_TRANSIT to simulate arrival.',
      );
    }

    const stop = receipt.stops.find((s) => s.stopOrder === stopOrder);
    if (!stop) {
      throw new NotFoundException(
        `Stop ${stopOrder} not found in this receipt.`,
      );
    }
    if (stop.status !== DispatchReceiptStopStatus.PENDING) {
      throw new BadRequestException(
        `Stop ${stopOrder} has already been processed (status: ${stop.status}).`,
      );
    }

    // A truck cannot continue past a stop until that destination branch
    // confirms its own delivery checklist.
    for (const prevStop of receipt.stops) {
      if (prevStop.stopOrder < stopOrder) {
        if (
          prevStop.status !== DispatchReceiptStopStatus.CONFIRMED &&
          prevStop.status !== DispatchReceiptStopStatus.PARTIAL
        ) {
          throw new BadRequestException(
            `Stop ${prevStop.stopOrder} must be confirmed before the truck can continue to stop ${stopOrder}.`,
          );
        }
      }
    }

    await this.markStopArrived(receipt, stopOrder);

    return this.populateReceipt(receipt);
  }

  // ── Confirm Stop (by destination branch owner) ───────────────────────────

  async confirmStop(
    ownerId: string,
    receiptId: string,
    stopOrder: number,
    dto: ConfirmStopReceiptDto,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const receipt = await this.receiptModel.findById(receiptId).exec();
    if (!receipt) {
      throw new NotFoundException('Dispatch receipt not found.');
    }

    const stop = receipt.stops.find((s) => s.stopOrder === stopOrder);
    if (!stop) {
      throw new NotFoundException(
        `Stop ${stopOrder} not found in this receipt.`,
      );
    }

    // Verify the confirming user owns the destination branch
    if (stop.destinationBranchId.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'You can only confirm stops at your own branch.',
      );
    }
    if (stop.status !== DispatchReceiptStopStatus.ARRIVED) {
      throw new BadRequestException(
        `Stop ${stopOrder} must have ARRIVED status before confirmation (current: ${stop.status}).`,
      );
    }

    // Validate that flagged IDs actually belong to this stop
    const stopShipmentIdSet = new Set(
      stop.shipmentIds.map((id) => id.toString()),
    );

    for (const missingId of dto.missingShipmentIds ?? []) {
      if (!stopShipmentIdSet.has(missingId)) {
        throw new BadRequestException(
          `Shipment ${missingId} is not part of this stop.`,
        );
      }
    }
    for (const damagedId of dto.damagedShipmentIds ?? []) {
      if (!stopShipmentIdSet.has(damagedId)) {
        throw new BadRequestException(
          `Shipment ${damagedId} is not part of this stop.`,
        );
      }
    }

    const hasMissing = (dto.missingShipmentIds ?? []).length > 0;

    stop.status = hasMissing
      ? DispatchReceiptStopStatus.PARTIAL
      : DispatchReceiptStopStatus.CONFIRMED;
    stop.confirmedAt = new Date();
    stop.confirmedByUserId = new Types.ObjectId(ownerId);
    stop.confirmationNotes = dto.notes?.trim() || null;
    stop.missingShipmentIds = (dto.missingShipmentIds ?? []).map(
      (id) => new Types.ObjectId(id),
    );
    stop.damagedShipmentIds = (dto.damagedShipmentIds ?? []).map(
      (id) => new Types.ObjectId(id),
    );

    // Check if ALL stops are now confirmed/partial → auto-complete receipt
    const allStopsDone = receipt.stops.every(
      (s) =>
        s.status === DispatchReceiptStopStatus.CONFIRMED ||
        s.status === DispatchReceiptStopStatus.PARTIAL,
    );
    if (allStopsDone) {
      receipt.status = DispatchReceiptStatus.COMPLETED;
      receipt.completedAt = new Date();
      receipt.simulationProgress = 1;
      receipt.simulationSegmentStartedAt = null;
      await this.userModel.updateOne(
        { _id: receipt.driverId },
        {
          $set: {
            availabilityStatus: DriverAvailabilityStatus.AVAILABLE,
          },
        },
      );
    } else {
      receipt.simulationSegmentStartedAt = new Date();
    }

    await receipt.save();
    const populated = await this.populateReceipt(receipt);
    return this.scopeReceiptForDestination(populated, branch._id.toString());
  }

  // ── Cancel ───────────────────────────────────────────────────────────────

  async cancelReceipt(ownerId: string, receiptId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const receipt = await this.receiptModel.findById(receiptId).exec();
    if (!receipt) {
      throw new NotFoundException('Dispatch receipt not found.');
    }
    if (receipt.sourceBranchId.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This dispatch receipt does not belong to your branch.',
      );
    }
    if (receipt.status !== DispatchReceiptStatus.CREATED) {
      throw new BadRequestException(
        'Only receipts in CREATED status can be cancelled.',
      );
    }

    receipt.status = DispatchReceiptStatus.CANCELLED;
    receipt.cancelledAt = new Date();
    await receipt.save();

    // Revert all shipments back to CREATED and unlink
    const allShipmentIds = receipt.stops.flatMap((s) => s.shipmentIds);
    await this.shipmentModel.updateMany(
      { _id: { $in: allShipmentIds } },
      {
        $set: {
          status: BranchLogisticsStatus.CREATED,
          assignedDriverId: null,
          assignedVehicleId: null,
          assignedAt: null,
          dispatchReceiptId: null,
        },
      },
    );

    await this.userModel.updateOne(
      { _id: receipt.driverId },
      {
        $set: {
          availabilityStatus: DriverAvailabilityStatus.AVAILABLE,
        },
      },
    );

    return this.populateReceipt(receipt);
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  async listOutboundReceipts(ownerId: string, query: QueryDispatchReceiptsDto) {
    const branch = await this.getBranchForOwner(ownerId);
    const where: Record<string, any> = {
      sourceBranchId: branch._id,
    };
    if (query.status) where.status = query.status;
    if (query.receiptNumber) {
      where.receiptNumber = query.receiptNumber.trim().toUpperCase();
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.$lte = new Date(query.dateTo);
    }

    const receipts = await this.receiptModel
      .find(where)
      .sort({ createdAt: -1 })
      .exec();

    return this.populateReceipt(receipts);
  }

  async listInboundReceipts(ownerId: string, query: QueryDispatchReceiptsDto) {
    const branch = await this.getBranchForOwner(ownerId);
    const where: Record<string, any> = {
      'stops.destinationBranchId': branch._id,
    };
    if (query.status) where.status = query.status;
    if (query.receiptNumber) {
      where.receiptNumber = query.receiptNumber.trim().toUpperCase();
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.$lte = new Date(query.dateTo);
    }

    const receipts = await this.receiptModel
      .find(where)
      .sort({ createdAt: -1 })
      .exec();

    const populatedReceipts = await this.populateReceipt(receipts);
    return populatedReceipts.map((receipt) =>
      this.scopeReceiptForDestination(receipt, branch._id.toString()),
    );
  }

  async getReceipt(ownerId: string, receiptId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const receipt = await this.receiptModel.findById(receiptId).exec();
    if (!receipt) {
      throw new NotFoundException('Dispatch receipt not found.');
    }

    // Verify user's branch is either the source or a destination
    const isSource =
      receipt.sourceBranchId.toString() === branch._id.toString();
    const isDestination = receipt.stops.some(
      (s) => s.destinationBranchId.toString() === branch._id.toString(),
    );

    if (!isSource && !isDestination) {
      throw new BadRequestException(
        'This receipt does not involve your branch.',
      );
    }

    const populatedReceipt = await this.populateReceipt(receipt);
    return isSource
      ? populatedReceipt
      : this.scopeReceiptForDestination(
          populatedReceipt,
          branch._id.toString(),
        );
  }
}
