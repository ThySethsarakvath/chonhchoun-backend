import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DriverAvailabilityStatus } from '../../common/enum/driver-availability-status.enum';
import { normalisePhone } from '../../common/utils/phone.util';
import { BranchLogisticsPricingMode } from '../../common/enum/branch-logistics-pricing-mode.enum';
import { BranchLogisticsStatus } from '../../common/enum/branch-logistics-status.enum';
import { Role } from '../../common/enum/role.enum';
import { VehicleOwnershipType } from '../../common/enum/vehicle-ownership-type.enum';
import { VehicleStatus } from '../../common/enum/vehicle-status.enum';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import {
  BranchLogisticsPricingRule,
  BranchLogisticsPricingRuleDocument,
} from '../../shared/schemas/branch-logistics-pricing-rule.schema';
import {
  BranchLogisticsShipment,
  BranchLogisticsShipmentDocument,
} from '../../shared/schemas/branch-logistics-shipment.schema';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentDocument,
} from '../../shared/schemas/driver-vehicle-assignment.schema';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { Vehicle, VehicleDocument } from '../../shared/schemas/vehicle.schema';
import { CreateBranchLogisticsShipmentDto } from './dto/create-branch-logistics-shipment.dto';
import { AssignBranchLogisticsTripDto } from './dto/assign-branch-logistics-trip.dto';
import { CalculateBranchLogisticsPriceDto } from './dto/calculate-branch-logistics-price.dto';
import { QueryBranchLogisticsShipmentsDto } from './dto/query-branch-logistics-shipments.dto';
import { UpdateBranchLogisticsStatusDto } from './dto/update-branch-logistics-status.dto';
import { CreateBranchLogisticsPricingRuleDto } from './dto/create-branch-logistics-pricing-rule.dto';
import { BranchWalletService } from '../branch-wallet/branch-wallet.service';
import { RevenueSharingService } from '../admin/revenue-sharing.service';

@Injectable()
export class BranchLogisticsService {
  constructor(
    @InjectModel(BranchLogisticsShipment.name)
    private readonly shipmentModel: Model<BranchLogisticsShipmentDocument>,
    @InjectModel(BranchLogisticsPricingRule.name)
    private readonly pricingRuleModel: Model<BranchLogisticsPricingRuleDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(DriverVehicleAssignment.name)
    private readonly assignmentModel: Model<DriverVehicleAssignmentDocument>,
    private readonly branchWalletService: BranchWalletService,
    private readonly revenueSharingService: RevenueSharingService,
  ) {}

  async getBranchForOwner(ownerId: string) {
    const branch = await this.branchModel.findOne({ ownerId }).exec();
    if (!branch) {
      throw new NotFoundException('No branch assigned to this branch owner.');
    }
    return branch;
  }

  async createShipment(ownerId: string, dto: CreateBranchLogisticsShipmentDto) {
    const senderBranch = await this.getBranchForOwner(ownerId);
    const senderUser = await this.resolveTicketUser(
      dto.senderUserId,
      'Sender user',
    );
    const receiverUser = await this.resolveTicketUser(
      dto.receiverUserId,
      'Receiver user',
    );
    const receiverBranch = await this.branchModel
      .findById(dto.receiverBranchId)
      .exec();

    if (!receiverBranch || !receiverBranch.isActive) {
      throw new NotFoundException('Receiver branch not found.');
    }
    if (receiverBranch._id.toString() === senderBranch._id.toString()) {
      throw new BadRequestException(
        'Sender branch and receiver branch must be different.',
      );
    }
    if (senderUser._id.toString() === receiverUser._id.toString()) {
      throw new BadRequestException(
        'Sender and receiver must be different user accounts.',
      );
    }

    const price = await this.calculatePrice({
      ...dto,
      senderBranchId: senderBranch._id.toString(),
    });
    const shipment = await this.shipmentModel.create({
      ticketNumber: this.generateTicketNumber(senderBranch, receiverBranch),
      senderBranchId: senderBranch._id,
      receiverBranchId: receiverBranch._id,
      createdByUserId: new Types.ObjectId(ownerId),
      senderUserId: senderUser ? senderUser._id : null,
      receiverUserId: receiverUser ? receiverUser._id : null,
      sender: {
        name: senderUser?.name?.trim() || dto.senderName.trim(),
        phone: senderUser?.phone || normalisePhone(dto.senderPhone),
      },
      receiver: {
        name: receiverUser?.name?.trim() || dto.receiverName.trim(),
        phone: receiverUser?.phone || normalisePhone(dto.receiverPhone),
      },
      itemDescription: dto.itemDescription.trim(),
      pricingMode: dto.pricingMode,
      weightKg: dto.weightKg ?? null,
      lengthCm: dto.lengthCm ?? null,
      widthCm: dto.widthCm ?? null,
      heightCm: dto.heightCm ?? null,
      volumeM3: price.volumeM3,
      chargeableWeightKg: price.chargeableWeightKg,
      unitPrice: price.unitPrice,
      startingFee: price.startingFee,
      chargeableFee: price.chargeableFee,
      routeFee: price.routeFee,
      serviceFee: price.serviceFee,
      basePrice: price.basePrice,
      extraFee: dto.extraFee ?? 0,
      discount: dto.discount ?? 0,
      totalPrice: price.totalPrice,
      currency: 'USD',
      paymentStatus: 'PAID',
      amountPaid: price.totalPrice,
      paidAt: new Date(),
      status: BranchLogisticsStatus.CREATED,
      notes: dto.notes?.trim() || null,
      assignedDriverId: null,
      assignedVehicleId: null,
      assignedAt: null,
    });

    const revenueShare = await this.calculateRevenueShare(shipment.totalPrice);

    await this.branchWalletService.createShipmentPendingTransactions({
      shipmentId: shipment._id,
      ticketNumber: shipment.ticketNumber,
      senderBranchId: shipment.senderBranchId,
      receiverBranchId: shipment.receiverBranchId,
      senderAmount: revenueShare.senderAmount,
      receiverAmount: revenueShare.receiverAmount,
      companyAmount: revenueShare.companyAmount,
      senderPercent: revenueShare.senderRevenueSharePercent,
      receiverPercent: revenueShare.receiverRevenueSharePercent,
      companyPercent: revenueShare.companyRevenueSharePercent,
      metadata: {
        revenueShareVersion: revenueShare.version,
        senderUser: {
          name: shipment.sender.name,
          phone: shipment.sender.phone,
        },
        receiverUser: {
          name: shipment.receiver.name,
          phone: shipment.receiver.phone,
        },
        senderBranch: {
          name: senderBranch.name,
          address: senderBranch.address ?? null,
          ownerName: (senderBranch as any).ownerId?.name ?? null,
        },
        receiverBranch: {
          name: receiverBranch.name,
          address: receiverBranch.address ?? null,
          ownerName: (receiverBranch as any).ownerId?.name ?? null,
        },
        totalPrice: shipment.totalPrice,
        amountPaid: shipment.amountPaid,
        paymentStatus: shipment.paymentStatus,
      },
    });

    return this.findShipmentForBranch(ownerId, shipment._id.toString());
  }

  async assignTripToDriver(
    ownerId: string,
    dto: AssignBranchLogisticsTripDto,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const driver = await this.userModel.findById(dto.driverId).exec();

    if (!driver || driver.role !== Role.DRIVER) {
      throw new NotFoundException('Driver not found.');
    }
    if (driver.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This driver does not belong to your branch.',
      );
    }
    if (driver.availabilityStatus !== DriverAvailabilityStatus.AVAILABLE) {
      throw new BadRequestException(
        'Only available branch drivers can receive a prepared trip.',
      );
    }

    const activeAssignment = await this.assignmentModel
      .findOne({
        driverId: driver._id,
        isActive: true,
      })
      .populate('vehicleId')
      .exec();

    if (!activeAssignment || !activeAssignment.vehicleId) {
      throw new BadRequestException(
        'Assign a branch vehicle to this driver first.',
      );
    }

    const vehicle = activeAssignment.vehicleId as any;
    if (vehicle.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'Assigned vehicle does not belong to your branch.',
      );
    }
    if (vehicle.ownershipType !== VehicleOwnershipType.COMPANY) {
      throw new BadRequestException(
        'City express vehicles cannot be used for branch logistics trips.',
      );
    }
    if (!vehicle.isActive) {
      throw new BadRequestException('Assigned vehicle is inactive.');
    }
    if (
      vehicle.status !== VehicleStatus.IN_USE &&
      vehicle.status !== VehicleStatus.AVAILABLE
    ) {
      throw new BadRequestException(
        'Assigned vehicle is not ready for a branch logistics trip.',
      );
    }

    const uniqueShipmentIds = [...new Set(dto.shipmentIds)];
    const shipments = await this.shipmentModel
      .find({
        _id: { $in: uniqueShipmentIds.map((id) => new Types.ObjectId(id)) },
      })
      .exec();

    if (shipments.length !== uniqueShipmentIds.length) {
      throw new NotFoundException('One or more tickets were not found.');
    }

    const receiverBranchId = shipments[0].receiverBranchId?.toString();
    for (const shipment of shipments) {
      if (shipment.senderBranchId?.toString() !== branch._id.toString()) {
        throw new BadRequestException(
          'Only outbound tickets from your branch can be prepared for a trip.',
        );
      }
      if (shipment.status !== BranchLogisticsStatus.CREATED) {
        throw new BadRequestException(
          'Only waiting tickets can be included in a prepared trip.',
        );
      }
      if (shipment.receiverBranchId?.toString() !== receiverBranchId) {
        throw new BadRequestException(
          'Prepared trip tickets must share the same destination branch.',
        );
      }
    }

    const assignmentTime = new Date();
    for (const shipment of shipments) {
      shipment.assignedDriverId = driver._id;
      shipment.assignedVehicleId = vehicle._id;
      shipment.assignedAt = assignmentTime;
      shipment.status = BranchLogisticsStatus.ASSIGNED;
      if (dto.notes !== undefined) {
        const trimmedNote = dto.notes?.trim();
        const existingNotes = shipment.notes?.trim();
        if (trimmedNote) {
          shipment.notes = existingNotes
            ? `${existingNotes}\n${trimmedNote}`
            : trimmedNote;
        } else {
          shipment.notes = existingNotes || null;
        }
      }
      await shipment.save();
    }

    return Promise.all(
      shipments.map((shipment) =>
        this.findShipmentForBranch(ownerId, shipment._id.toString()),
      ),
    );
  }

  async listTicketUsers(search?: string) {
    const filters: Record<string, any> = {
      isActive: true,
      phone: { $exists: true, $ne: null },
      role: Role.CUSTOMER,
    };

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filters.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    const users = await this.userModel
      .find(filters)
      .select('name email phone role isActive avatarUrl')
      .sort({ role: 1, name: 1 })
      .limit(50)
      .exec();

    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl ?? null,
    }));
  }

  async calculatePrice(
    dto: CalculateBranchLogisticsPriceDto & { senderBranchId?: string },
  ) {
    if (dto.weightKg == null || dto.weightKg <= 0) {
      throw new BadRequestException(
        'Weight is required and must be greater than 0 kg.',
      );
    }
    if (dto.weightKg > 200) {
      throw new BadRequestException(
        'This ticket flow currently supports packages up to 200 kg.',
      );
    }

    const volumeM3 = this.computeVolumeM3(
      dto.lengthCm,
      dto.widthCm,
      dto.heightCm,
    );
    const weightKg = dto.weightKg;
    const tier = this.resolveWeightTier(weightKg, dto.pricingMode);
    const chargeableWeightKg = weightKg;
    const unitPrice = Number((tier.packageFee / weightKg).toFixed(4));
    const startingFee = 0;
    const chargeableFee = tier.packageFee;
    const routeFee = 0;
    const serviceFee = tier.serviceFee;
    const basePrice = startingFee + chargeableFee + routeFee + serviceFee;
    const totalPrice = Math.max(
      basePrice + (dto.extraFee ?? 0) - (dto.discount ?? 0),
      0,
    );

    return {
      pricingMode: dto.pricingMode,
      volumeM3,
      chargeableWeightKg,
      unitPrice,
      startingFee,
      chargeableFee,
      routeFee,
      serviceFee,
      basePrice,
      extraFee: dto.extraFee ?? 0,
      discount: dto.discount ?? 0,
      totalPrice,
      currency: 'USD',
    };
  }

  async listShipmentsForBranch(
    ownerId: string,
    query: QueryBranchLogisticsShipmentsDto,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const direction = query.direction ?? 'all';
    const where: Record<string, any> = {};

    if (direction === 'outbound') where.senderBranchId = branch._id;
    if (direction === 'inbound') where.receiverBranchId = branch._id;
    if (direction === 'all') {
      where.$or = [
        { senderBranchId: branch._id },
        { receiverBranchId: branch._id },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.ticketNumber)
      where.ticketNumber = query.ticketNumber.trim().toUpperCase();
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.$lte = new Date(query.dateTo);
    }

    const shipments = await this.shipmentModel
      .find(where)
      .sort({ createdAt: -1 })
      .exec();

    return this.populateShipmentBranches(shipments);
  }

  async listShipmentsForCustomer(userId: string) {
    const shipments = await this.shipmentModel
      .find({
        $or: [
          { senderUserId: new Types.ObjectId(userId) },
          { receiverUserId: new Types.ObjectId(userId) },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();

    return this.populateShipmentBranches(shipments);
  }

  async listAssignedShipmentsForDriver(driverId: string) {
    const shipments = await this.shipmentModel
      .find({
        assignedDriverId: new Types.ObjectId(driverId),
        status: {
          $nin: [
            BranchLogisticsStatus.COMPLETED,
            BranchLogisticsStatus.CANCELLED,
          ],
        },
      })
      .sort({ assignedAt: -1, createdAt: -1 })
      .exec();

    return this.populateShipmentBranches(shipments);
  }

  async findShipmentForBranch(ownerId: string, shipmentId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    await this.populateShipmentBranches(shipment);

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    const belongsToBranch =
      shipment.senderBranchId?.toString() === branch._id.toString() ||
      shipment.receiverBranchId?.toString() === branch._id.toString() ||
      (typeof shipment.senderBranchId === 'object' &&
        shipment.senderBranchId?._id?.toString() === branch._id.toString()) ||
      (typeof shipment.receiverBranchId === 'object' &&
        shipment.receiverBranchId?._id?.toString() === branch._id.toString());

    if (!belongsToBranch) {
      throw new BadRequestException(
        'This shipment does not belong to your branch.',
      );
    }

    return shipment;
  }

  async receiveAtSenderWarehouse(
    ownerId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForBranch(ownerId, shipmentId);
    const isLegacyAssignedShipment =
      shipment.status === BranchLogisticsStatus.CREATED &&
      !!shipment.assignedDriverId &&
      !!shipment.assignedVehicleId;
    if (
      shipment.status !== BranchLogisticsStatus.ASSIGNED &&
      !isLegacyAssignedShipment
    ) {
      throw new BadRequestException(
        'Only assigned shipments can be collected from the sender branch.',
      );
    }
    shipment.status = BranchLogisticsStatus.RECEIVED_AT_SENDER_WAREHOUSE;
    shipment.receivedAtSenderWarehouseAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();
    return shipment;
  }

  async collectAssignedShipmentForDriver(
    driverId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForDriver(driverId, shipmentId);
    if (
      shipment.status !== BranchLogisticsStatus.ASSIGNED &&
      !(
        shipment.status === BranchLogisticsStatus.CREATED &&
        shipment.assignedDriverId?.toString() === driverId &&
        shipment.assignedVehicleId
      )
    ) {
      throw new BadRequestException(
        'Only assigned tickets can be collected from branch.',
      );
    }

    shipment.status = BranchLogisticsStatus.RECEIVED_AT_SENDER_WAREHOUSE;
    shipment.receivedAtSenderWarehouseAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();
    return this.populateShipmentBranches(shipment);
  }

  async dispatchShipment(
    ownerId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForBranch(ownerId, shipmentId);
    if (
      shipment.status !== BranchLogisticsStatus.RECEIVED_AT_SENDER_WAREHOUSE
    ) {
      throw new BadRequestException(
        'Shipment must be received at sender warehouse before dispatch.',
      );
    }
    if (!shipment.assignedDriverId || !shipment.assignedVehicleId) {
      throw new BadRequestException(
        'Assign this shipment to a branch driver before dispatch.',
      );
    }
    shipment.status = BranchLogisticsStatus.IN_TRANSIT;
    shipment.inTransitAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();
    return shipment;
  }

  async dispatchAssignedShipmentForDriver(
    driverId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForDriver(driverId, shipmentId);
    if (
      shipment.status !== BranchLogisticsStatus.RECEIVED_AT_SENDER_WAREHOUSE
    ) {
      throw new BadRequestException(
        'Ticket must be collected before delivery starts.',
      );
    }
    shipment.status = BranchLogisticsStatus.IN_TRANSIT;
    shipment.inTransitAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();
    return this.populateShipmentBranches(shipment);
  }

  async receiveAtDestinationWarehouse(
    ownerId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForBranch(ownerId, shipmentId);
    if (shipment.status !== BranchLogisticsStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'Shipment must be in transit before destination receipt.',
      );
    }
    shipment.status = BranchLogisticsStatus.RECEIVED_AT_RECEIVER_WAREHOUSE;
    shipment.receivedAtReceiverWarehouseAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();
    return shipment;
  }

  async arriveAssignedShipmentForDriver(
    driverId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForDriver(driverId, shipmentId);
    if (shipment.status !== BranchLogisticsStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'Ticket must be delivering before arrival can be confirmed.',
      );
    }
    shipment.status = BranchLogisticsStatus.RECEIVED_AT_RECEIVER_WAREHOUSE;
    shipment.receivedAtReceiverWarehouseAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();
    return this.populateShipmentBranches(shipment);
  }

  async markReadyForPickup(
    ownerId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForBranch(ownerId, shipmentId);
    if (
      shipment.status !== BranchLogisticsStatus.RECEIVED_AT_RECEIVER_WAREHOUSE
    ) {
      throw new BadRequestException(
        'Shipment must be received at destination before it is ready.',
      );
    }
    shipment.status = BranchLogisticsStatus.READY_FOR_PICKUP;
    shipment.readyForPickupAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();
    return shipment;
  }

  async completeShipment(
    ownerId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForBranch(ownerId, shipmentId);
    if (
      shipment.status !== BranchLogisticsStatus.READY_FOR_PICKUP &&
      shipment.status !== BranchLogisticsStatus.RECEIVED_AT_RECEIVER_WAREHOUSE
    ) {
      throw new BadRequestException(
        'Shipment must be ready at destination before completion.',
      );
    }

    shipment.status = BranchLogisticsStatus.COMPLETED;
    shipment.completedAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();

    const revenueShare = await this.calculateRevenueShare(shipment.totalPrice);

    await this.branchWalletService.createShipmentRevenueTransactions({
      shipmentId: shipment._id,
      ticketNumber: shipment.ticketNumber,
      senderBranchId: shipment.senderBranchId,
      receiverBranchId: shipment.receiverBranchId,
      senderAmount: revenueShare.senderAmount,
      receiverAmount: revenueShare.receiverAmount,
      companyAmount: revenueShare.companyAmount,
      senderPercent: revenueShare.senderRevenueSharePercent,
      receiverPercent: revenueShare.receiverRevenueSharePercent,
      companyPercent: revenueShare.companyRevenueSharePercent,
      metadata: {
        revenueShareVersion: revenueShare.version,
        totalPrice: shipment.totalPrice,
        paymentStatus: shipment.paymentStatus,
        completedAt: shipment.completedAt,
      },
    });

    return {
      shipment,
      revenueShare: {
        senderRevenueSharePercent: revenueShare.senderRevenueSharePercent,
        receiverRevenueSharePercent: revenueShare.receiverRevenueSharePercent,
        companyRevenueSharePercent: revenueShare.companyRevenueSharePercent,
        version: revenueShare.version,
        senderAmount: revenueShare.senderAmount,
        receiverAmount: revenueShare.receiverAmount,
        companyAmount: revenueShare.companyAmount,
      },
    };
  }

  async cancelShipment(
    ownerId: string,
    shipmentId: string,
    dto: UpdateBranchLogisticsStatusDto,
  ) {
    const shipment = await this.findShipmentForBranch(ownerId, shipmentId);
    if (shipment.status === BranchLogisticsStatus.COMPLETED) {
      throw new BadRequestException('Completed shipments cannot be cancelled.');
    }
    shipment.status = BranchLogisticsStatus.CANCELLED;
    shipment.cancelledAt = new Date();
    if (dto.notes !== undefined) shipment.notes = dto.notes?.trim() || null;
    await shipment.save();
    await this.branchWalletService.voidShipmentPendingTransactions(
      shipment._id,
      'Shipment cancelled',
    );
    await this.branchWalletService.reverseShipmentRevenueTransactions({
      shipmentId: shipment._id,
      ticketNumber: shipment.ticketNumber,
      reason: `Revenue reversal for cancelled ${shipment.ticketNumber}`,
    });
    return shipment;
  }

  async createPricingRule(dto: CreateBranchLogisticsPricingRuleDto) {
    return this.pricingRuleModel.create({
      senderBranchId: dto.senderBranchId
        ? new Types.ObjectId(dto.senderBranchId)
        : null,
      receiverBranchId: dto.receiverBranchId
        ? new Types.ObjectId(dto.receiverBranchId)
        : null,
      pricingMode: dto.pricingMode,
      baseFee: dto.baseFee ?? 0,
      pricePerKg: dto.pricePerKg ?? null,
      pricePerM3: dto.pricePerM3 ?? null,
      routeFee: dto.routeFee ?? 0,
      serviceFee: dto.serviceFee ?? 0,
      minPrice: dto.minPrice ?? 0,
      volumeDivisor: dto.volumeDivisor ?? 250,
      isActive: true,
    });
  }

  async listPricingRules() {
    return this.pricingRuleModel
      .find()
      .populate('senderBranchId', 'name branchNumber code')
      .populate('receiverBranchId', 'name branchNumber code')
      .sort({ createdAt: -1 })
      .exec();
  }

  private async populateShipmentBranches<T>(docs: T): Promise<T> {
    return this.shipmentModel.populate(docs, [
        {
          path: 'senderBranchId',
          select: 'name branchNumber code address description ownerId',
          populate: {
            path: 'ownerId',
            select: 'name phone',
          },
        },
        {
          path: 'receiverBranchId',
          select: 'name branchNumber code address description ownerId',
          populate: {
            path: 'ownerId',
            select: 'name phone',
          },
        },
        {
          path: 'assignedDriverId',
          select: 'name phone availabilityStatus maxLoadWeightKg maxPackageCount',
        },
        {
          path: 'assignedVehicleId',
          select:
            'code plateNumber type maxWeightKg maxVolumeM3 maxPackageCount status isActive',
        },
      ]) as Promise<T>;
  }

  private async findShipmentForDriver(driverId: string, shipmentId: string) {
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }
    if (shipment.assignedDriverId?.toString() !== driverId) {
      throw new BadRequestException(
        'This shipment is not assigned to the current driver.',
      );
    }

    await this.populateShipmentBranches(shipment);
    return shipment;
  }

  private async resolveShipmentAssignment(branchId: string, requiredWeightKg: number) {
    const drivers = await this.userModel
      .find({
        branchId: new Types.ObjectId(branchId),
        role: Role.DRIVER,
        isActive: true,
        availabilityStatus: DriverAvailabilityStatus.AVAILABLE,
      })
      .select(
        'name phone availabilityStatus maxLoadWeightKg maxPackageCount branchId role isActive',
      )
      .exec();

    if (drivers.length === 0) {
      return null;
    }

    const driverIds = drivers.map((driver) => driver._id);
    const [assignments, activeShipments] = await Promise.all([
      this.assignmentModel
        .find({
          driverId: { $in: driverIds },
          isActive: true,
        })
        .populate('vehicleId')
        .exec(),
      this.shipmentModel
        .find({
          assignedDriverId: { $in: driverIds },
          status: {
            $nin: [
              BranchLogisticsStatus.COMPLETED,
              BranchLogisticsStatus.CANCELLED,
            ],
          },
        })
        .select('assignedDriverId weightKg')
        .exec(),
    ]);

    const activeLoadByDriver = new Map<
      string,
      { packageCount: number; totalWeightKg: number }
    >();

    for (const shipment of activeShipments) {
      const driverId = shipment.assignedDriverId?.toString();
      if (!driverId) continue;
      const current = activeLoadByDriver.get(driverId) ?? {
        packageCount: 0,
        totalWeightKg: 0,
      };
      current.packageCount += 1;
      current.totalWeightKg += shipment.weightKg ?? 0;
      activeLoadByDriver.set(driverId, current);
    }

    const candidates = assignments
      .map((assignment) => {
        const driver = drivers.find(
          (item) => item._id.toString() === assignment.driverId.toString(),
        );
        const vehicle = assignment.vehicleId as unknown as VehicleDocument | null;

        if (!driver || !vehicle) return null;
        if (
          vehicle.ownershipType !== VehicleOwnershipType.COMPANY ||
          !vehicle.isActive ||
          vehicle.status !== VehicleStatus.IN_USE ||
          vehicle.branchId?.toString() !== branchId
        ) {
          return null;
        }

        const activeLoad = activeLoadByDriver.get(driver._id.toString()) ?? {
          packageCount: 0,
          totalWeightKg: 0,
        };

        const maxWeightKg =
          vehicle.maxWeightKg ?? driver.maxLoadWeightKg ?? Number.POSITIVE_INFINITY;
        const maxPackageCount =
          vehicle.maxPackageCount ??
          driver.maxPackageCount ??
          Number.POSITIVE_INFINITY;
        const remainingWeightKg = maxWeightKg - activeLoad.totalWeightKg;
        const remainingPackageCount =
          maxPackageCount - activeLoad.packageCount;

        if (remainingWeightKg < requiredWeightKg || remainingPackageCount < 1) {
          return null;
        }

        return {
          driver,
          vehicle,
          remainingWeightKg,
          remainingPackageCount,
          projectedRemainingWeightKg: remainingWeightKg - requiredWeightKg,
        };
      })
      .filter((candidate) => candidate != null)
      .sort((left, right) => {
        if (
          left!.projectedRemainingWeightKg !==
          right!.projectedRemainingWeightKg
        ) {
          return (
            left.projectedRemainingWeightKg - right.projectedRemainingWeightKg
          );
        }
        if (left.remainingPackageCount !== right.remainingPackageCount) {
          return left.remainingPackageCount - right.remainingPackageCount;
        }
        return left.driver.name.localeCompare(right.driver.name);
      });

    return candidates[0] ?? null;
  }

  private async resolvePricingRule(
    senderBranchId: string | null,
    receiverBranchId: string,
    pricingMode: BranchLogisticsPricingMode,
  ) {
    const where: Record<string, any> = {
      isActive: true,
      pricingMode,
    };
    if (senderBranchId)
      where.senderBranchId = new Types.ObjectId(senderBranchId);
    if (receiverBranchId)
      where.receiverBranchId = new Types.ObjectId(receiverBranchId);

    const specificRule = await this.pricingRuleModel.findOne(where).exec();
    if (specificRule) return specificRule;

    if (pricingMode === BranchLogisticsPricingMode.VIP) {
      const standardWhere = {
        ...where,
        pricingMode: BranchLogisticsPricingMode.STANDARD,
      };
      const standardRule = await this.pricingRuleModel
        .findOne(standardWhere)
        .exec();
      if (standardRule) {
        return {
          ...standardRule.toObject(),
          pricingMode: BranchLogisticsPricingMode.VIP,
          serviceFee: Math.max(standardRule.serviceFee ?? 0, 3),
        } as BranchLogisticsPricingRule;
      }
    }

    const fallbackByMode =
      pricingMode === BranchLogisticsPricingMode.VIP
        ? {
            baseFee: 1,
            pricePerKg: 1,
            pricePerM3: 120,
            routeFee: 5,
            serviceFee: 3,
            minPrice: 8,
            volumeDivisor: 250,
          }
        : {
            baseFee: 1,
            pricePerKg: 1,
            pricePerM3: 120,
            routeFee: 5,
            serviceFee: 0,
            minPrice: 5,
            volumeDivisor: 250,
          };

    return fallbackByMode as BranchLogisticsPricingRule;
  }

  private computeVolumeM3(
    lengthCm?: number,
    widthCm?: number,
    heightCm?: number,
  ) {
    if (!lengthCm || !widthCm || !heightCm) return 0;
    return Number(((lengthCm * widthCm * heightCm) / 1000000).toFixed(4));
  }

  private resolveWeightTier(
    weightKg: number,
    pricingMode: BranchLogisticsPricingMode,
  ) {
    if (weightKg <= 50) {
      return {
        packageFee: 2.5,
        serviceFee: pricingMode === BranchLogisticsPricingMode.VIP ? 1.5 : 0,
      };
    }

    if (weightKg <= 100) {
      return {
        packageFee: 3.5,
        serviceFee: pricingMode === BranchLogisticsPricingMode.VIP ? 1.5 : 0,
      };
    }

    return {
      packageFee: 4.5,
      serviceFee: pricingMode === BranchLogisticsPricingMode.VIP ? 1.5 : 0,
    };
  }

  private generateTicketNumber(
    senderBranch: BranchDocument,
    receiverBranch: BranchDocument,
  ) {
    const senderCode = (
      senderBranch.code ?? `B${senderBranch.branchNumber ?? 1}`
    )
      .toUpperCase()
      .replace(/\s+/g, '');
    const receiverCode = (
      receiverBranch.code ?? `B${receiverBranch.branchNumber ?? 1}`
    )
      .toUpperCase()
      .replace(/\s+/g, '');
    const sequence = Date.now().toString().slice(-6);
    return `BL-${senderCode}-${receiverCode}-${sequence}`;
  }

  private async calculateRevenueShare(totalPrice: number) {
    const config = await this.revenueSharingService.getCurrentConfig();
    const senderAmount = Number(
      ((totalPrice * config.senderBranchPercent) / 100).toFixed(2),
    );
    const receiverAmount = Number(
      ((totalPrice * config.receiverBranchPercent) / 100).toFixed(2),
    );
    const companyAmount = Number(
      (totalPrice - senderAmount - receiverAmount).toFixed(2),
    );

    return {
      version: config.version,
      senderRevenueSharePercent: config.senderBranchPercent,
      receiverRevenueSharePercent: config.receiverBranchPercent,
      companyRevenueSharePercent: config.companyPercent,
      senderAmount,
      receiverAmount,
      companyAmount,
    };
  }

  private async resolveTicketUser(
    userId: string | null | undefined,
    label: string,
  ) {
    if (!userId) {
      throw new BadRequestException(`${label} is required.`);
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException(`${label} is invalid.`);
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.isActive) {
      throw new NotFoundException(`${label} not found.`);
    }
    if (!user.phone) {
      throw new BadRequestException(
        `${label} is missing a phone number in the user account.`,
      );
    }
    if (user.role !== Role.CUSTOMER) {
      throw new BadRequestException(`${label} must be a customer account.`);
    }

    return user;
  }
}
