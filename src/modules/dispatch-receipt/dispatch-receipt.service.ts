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
        select: 'name branchNumber code address',
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
        select: 'name branchNumber code address',
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

    const shipmentMap = new Map(
      shipments.map((s) => [s._id.toString(), s]),
    );

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
      if (
        destBranch._id.toString() === sourceBranch._id.toString()
      ) {
        throw new BadRequestException(
          `Stop ${stopDto.stopOrder} destination cannot be the same as source branch.`,
        );
      }

      for (const shipmentId of stopDto.shipmentIds) {
        const shipment = shipmentMap.get(shipmentId);
        if (!shipment) continue;

        if (
          shipment.senderBranchId?.toString() !==
          sourceBranch._id.toString()
        ) {
          throw new BadRequestException(
            `Shipment ${shipment.ticketNumber} does not originate from your branch.`,
          );
        }
        if (
          shipment.receiverBranchId?.toString() !==
          destBranch._id.toString()
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

  // ── Simulate Arrival at Stop ─────────────────────────────────────────────

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

    // Ensure all earlier stops have been arrived at or confirmed
    for (const prevStop of receipt.stops) {
      if (prevStop.stopOrder < stopOrder) {
        if (prevStop.status === DispatchReceiptStopStatus.PENDING) {
          throw new BadRequestException(
            `Stop ${prevStop.stopOrder} must be arrived at before stop ${stopOrder}.`,
          );
        }
      }
    }

    stop.status = DispatchReceiptStopStatus.ARRIVED;
    stop.arrivedAt = new Date();
    await receipt.save();

    // Update shipments at this stop
    await this.shipmentModel.updateMany(
      { _id: { $in: stop.shipmentIds } },
      {
        $set: {
          status: BranchLogisticsStatus.RECEIVED_AT_RECEIVER_WAREHOUSE,
          receivedAtReceiverWarehouseAt: stop.arrivedAt,
        },
      },
    );

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
    }

    await receipt.save();
    return this.populateReceipt(receipt);
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

    return this.populateReceipt(receipt);
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  async listOutboundReceipts(
    ownerId: string,
    query: QueryDispatchReceiptsDto,
  ) {
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

  async listInboundReceipts(
    ownerId: string,
    query: QueryDispatchReceiptsDto,
  ) {
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

    return this.populateReceipt(receipts);
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

    return this.populateReceipt(receipt);
  }
}
