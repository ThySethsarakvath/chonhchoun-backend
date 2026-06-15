import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { normalisePhone } from '../../common/utils/phone.util';
import { DriverApplicationStatus } from '../../common/enum/driver-application-status.enum';
import {
  DriverApplication,
  DriverApplicationDocument,
} from '../../shared/schemas/driver-application.schema';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentDocument,
} from '../../shared/schemas/driver-vehicle-assignment.schema';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import { Role } from '../../common/enum/role.enum';
import { CloudinaryService } from '../database/cloudinary/cloudinary.service';
import { MailService } from '../mail/mail.service';
import { VehicleType } from '../../common/enum/package.enum';
import { DriverAvailabilityStatus } from '../../common/enum/driver-availability-status.enum';
import { DriverVehicleAssignmentType } from '../../common/enum/driver-vehicle-assignment-type.enum';
import { VehicleOwnershipType } from '../../common/enum/vehicle-ownership-type.enum';
import { VehicleStatus } from '../../common/enum/vehicle-status.enum';
import { Vehicle, VehicleDocument } from '../../shared/schemas/vehicle.schema';
import { AssignDriverVehicleDto } from './dto/assign-driver-vehicle.dto';
import { ApproveDriverApplicationDto } from './dto/approve-driver-application.dto';
import { CreateBranchVehicleDto } from './dto/create-branch-vehicle.dto';
import { CreateDriverApplicationDto } from './dto/create-driver-application.dto';
import { RejectDriverApplicationDto } from './dto/reject-driver-application.dto';
import { UpdateBranchVehicleDto } from './dto/update-branch-vehicle.dto';
import { UpdateDriverManagementDto } from './dto/update-driver-management.dto';

@Injectable()
export class DriverApplicationsService {
  constructor(
    @InjectModel(DriverApplication.name)
    private readonly applicationModel: Model<DriverApplicationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(DriverVehicleAssignment.name)
    private readonly assignmentModel: Model<DriverVehicleAssignmentDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
  ) {}

  private normalizeVehicleType(
    vehicleType: VehicleType | 'TRUCK_SMALL' | null | undefined,
  ): VehicleType | null {
    if (vehicleType == null) return null;
    if (vehicleType === 'TRUCK_SMALL') return VehicleType.TRUCK;
    return vehicleType;
  }

  private async getBranchForOwner(ownerId: string) {
    const branch = await this.branchModel.findOne({ ownerId }).exec();
    if (!branch) {
      throw new NotFoundException('No branch assigned to this branch owner.');
    }
    return branch;
  }

  private vehicleTypeList(
    types: Array<VehicleType | 'TRUCK_SMALL'> | null | undefined,
  ): VehicleType[] {
    return (types ?? []).reduce<VehicleType[]>((list, type) => {
      const normalized = this.normalizeVehicleType(type);
      if (normalized) list.push(normalized);
      return list;
    }, []);
  }

  private vehicleCapacityDefaults(vehicleType: VehicleType | null | undefined) {
    switch (vehicleType) {
      case VehicleType.MOTORCYCLE:
        return { maxWeightKg: 20, maxPackageCount: 5 };
      case VehicleType.TRUCK:
        return { maxWeightKg: 1500, maxPackageCount: 60 };
      case VehicleType.TRUCK_LARGE:
        return { maxWeightKg: 3500, maxPackageCount: 120 };
      default:
        return { maxWeightKg: null, maxPackageCount: null };
    }
  }

  private isDriverOwnedCityMotorcycle(vehicle: any, driverId?: string) {
    if (!vehicle) return false;
    return (
      vehicle.ownershipType === VehicleOwnershipType.DRIVER_OWNED &&
      vehicle.type === VehicleType.MOTORCYCLE &&
      (!driverId || vehicle.ownerDriverId?.toString() === driverId)
    );
  }

  private serializeVehicle(vehicle: any) {
    return {
      _id: vehicle._id,
      code: vehicle.code,
      plateNumber: vehicle.plateNumber ?? null,
      type: this.normalizeVehicleType(vehicle.type),
      ownershipType: vehicle.ownershipType,
      branchId:
        vehicle.branchId && typeof vehicle.branchId === 'object'
          ? vehicle.branchId._id
          : (vehicle.branchId ?? null),
      ownerDriverId:
        vehicle.ownerDriverId && typeof vehicle.ownerDriverId === 'object'
          ? vehicle.ownerDriverId._id
          : (vehicle.ownerDriverId ?? null),
      ownerDriverName:
        vehicle.ownerDriverId && typeof vehicle.ownerDriverId === 'object'
          ? vehicle.ownerDriverId.name
          : null,
      maxWeightKg: vehicle.maxWeightKg ?? null,
      maxVolumeM3: vehicle.maxVolumeM3 ?? null,
      maxPackageCount: vehicle.maxPackageCount ?? null,
      currentWarehouse: vehicle.currentWarehouse ?? null,
      status: vehicle.status,
      isActive: vehicle.isActive,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }

  private serializeDriver(driver: any, assignments: any[] = []) {
    return {
      _id: driver._id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      vehicleType: this.normalizeVehicleType(driver.vehicleType),
      assignedVehicleCode: driver.assignedVehicleCode ?? null,
      availabilityStatus:
        driver.availabilityStatus ?? DriverAvailabilityStatus.OFFLINE,
      supportedVehicleTypes: this.vehicleTypeList(driver.supportedVehicleTypes),
      licenseNumber: driver.licenseNumber ?? null,
      licenseExpiry: driver.licenseExpiry ?? null,
      maxLoadWeightKg: driver.maxLoadWeightKg ?? null,
      maxPackageCount: driver.maxPackageCount ?? null,
      avatarUrl: driver.avatarUrl ?? null,
      isActive: driver.isActive,
      createdAt: driver.createdAt,
      assignments: assignments.map((assignment) => ({
        _id: assignment._id,
        assignmentType: assignment.assignmentType,
        assignedAt: assignment.assignedAt,
        vehicle: assignment.vehicleId
          ? this.serializeVehicle(assignment.vehicleId)
          : null,
      })),
    };
  }

  async create(
    dto: CreateDriverApplicationDto,
    files: {
      avatar?: Express.Multer.File[];
      cv?: Express.Multer.File[];
      nationalId?: Express.Multer.File[];
      drivingLicense?: Express.Multer.File[];
    },
  ) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }
    if (dto.vehicleType === VehicleType.CAR) {
      throw new BadRequestException(
        'Car is no longer supported for driver registration. Use motorcycle, truck, or large truck.',
      );
    }

    const phone = normalisePhone(dto.phone);
    const branch = await this.branchModel.findById(dto.branchId).exec();
    if (!branch || !branch.isActive) {
      throw new BadRequestException('Selected branch is not available.');
    }

    const [avatarFile, cvFile, nationalIdFile, drivingLicenseFile] = [
      files.avatar?.[0],
      files.cv?.[0],
      files.nationalId?.[0],
      files.drivingLicense?.[0],
    ];
    const isOwnVehicleApplication = dto.vehicleType != null;
    const isMotorcycleApplication = dto.vehicleType === VehicleType.MOTORCYCLE;

    if (!avatarFile || !cvFile || !nationalIdFile) {
      throw new BadRequestException(
        'Avatar, CV, and national ID files are required.',
      );
    }
    if (
      (!isOwnVehicleApplication || !isMotorcycleApplication) &&
      !drivingLicenseFile
    ) {
      throw new BadRequestException(
        'Driving license is required unless the driver uses their own motorcycle.',
      );
    }

    const existingUser = await this.userModel.findOne({
      $or: [{ email: dto.email }, { phone }],
    });
    if (existingUser) {
      throw new ConflictException(
        'An account with this email or phone number already exists.',
      );
    }

    const existingPendingApplication = await this.applicationModel.findOne({
      $or: [{ email: dto.email }, { phone }],
      status: DriverApplicationStatus.PENDING,
    });
    if (existingPendingApplication) {
      throw new ConflictException(
        'A pending driver application already exists for this email or phone number.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const [avatar, cv, nationalId, drivingLicense] = await Promise.all([
      this.cloudinaryService.uploadImage(
        avatarFile,
        'chonhchoun/driver-applications/avatars',
      ),
      this.cloudinaryService.uploadDocument(
        cvFile,
        'chonhchoun/driver-applications/cv',
      ),
      this.cloudinaryService.uploadDocument(
        nationalIdFile,
        'chonhchoun/driver-applications/national-id',
      ),
      drivingLicenseFile
        ? this.cloudinaryService.uploadDocument(
            drivingLicenseFile,
            'chonhchoun/driver-applications/driving-license',
          )
        : Promise.resolve(null),
    ]);

    const application = await this.applicationModel.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone,
      passwordHash,
      branchId: branch._id,
      vehicleType: dto.vehicleType ?? null,
      plateNumber: dto.plateNumber?.trim() || null,
      avatar: {
        ...avatar,
        originalName: avatarFile.originalname,
      },
      cv: {
        ...cv,
        originalName: cvFile.originalname,
      },
      nationalId: {
        ...nationalId,
        originalName: nationalIdFile.originalname,
      },
      drivingLicense:
        drivingLicense && drivingLicenseFile
          ? {
              ...drivingLicense,
              originalName: drivingLicenseFile.originalname,
            }
          : null,
      status: DriverApplicationStatus.PENDING,
    });

    return this.serializeApplication(
      await application.populate('branchId', 'name branchNumber address phone'),
    );
  }

  async listForBranchOwner(ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);

    const applications = await this.applicationModel
      .find({ branchId: branch._id })
      .populate('branchId', 'name branchNumber address phone')
      .sort({ createdAt: -1 })
      .exec();

    return applications.map((application) =>
      this.serializeApplication(application),
    );
  }

  async listDriversForBranchOwner(ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);

    const drivers = await this.userModel
      .find({
        role: Role.DRIVER,
        branchId: branch._id,
      })
      .sort({ createdAt: -1 })
      .exec();
    const assignments = await this.assignmentModel
      .find({
        driverId: { $in: drivers.map((driver) => driver._id) },
        isActive: true,
      })
      .populate('vehicleId')
      .exec();

    return drivers.map((driver) =>
      this.serializeDriver(
        driver,
        assignments.filter(
          (assignment) =>
            assignment.driverId.toString() === driver._id.toString(),
        ),
      ),
    );
  }

  async listVehiclesForBranchOwner(ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const vehicles = await this.vehicleModel
      .find({
        $or: [
          { branchId: branch._id },
          {
            ownershipType: VehicleOwnershipType.DRIVER_OWNED,
            branchId: branch._id,
          },
        ],
      })
      .populate('ownerDriverId', 'name')
      .sort({ createdAt: -1 })
      .exec();

    return vehicles.map((vehicle) => this.serializeVehicle(vehicle));
  }

  async getManagementOverviewForBranchOwner(ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const [drivers, vehicles, assignments] = await Promise.all([
      this.userModel
        .find({
          role: Role.DRIVER,
          branchId: branch._id,
        })
        .sort({ createdAt: -1 })
        .exec(),
      this.vehicleModel
        .find({ branchId: branch._id })
        .populate('ownerDriverId', 'name')
        .sort({ createdAt: -1 })
        .exec(),
      this.assignmentModel
        .find({ isActive: true })
        .populate('vehicleId')
        .exec(),
    ]);

    const branchDriverIds = drivers.map((driver) => driver._id.toString());
    const scopedAssignments = assignments.filter((assignment) =>
      branchDriverIds.includes(assignment.driverId.toString()),
    );

    const serializedDrivers = drivers.map((driver) =>
      this.serializeDriver(
        driver,
        scopedAssignments.filter(
          (assignment) =>
            assignment.driverId.toString() === driver._id.toString(),
        ),
      ),
    );
    const serializedVehicles = vehicles.map((vehicle) =>
      this.serializeVehicle(vehicle),
    );

    return {
      branch: {
        _id: branch._id,
        name: branch.name,
        branchNumber: branch.branchNumber ?? null,
        code: branch.code ?? null,
      },
      summary: {
        totalDrivers: serializedDrivers.length,
        availableDrivers: serializedDrivers.filter(
          (driver) =>
            driver.availabilityStatus === DriverAvailabilityStatus.AVAILABLE,
        ).length,
        totalVehicles: serializedVehicles.length,
        companyVehicles: serializedVehicles.filter(
          (vehicle) => vehicle.ownershipType === VehicleOwnershipType.COMPANY,
        ).length,
        ownVehicleDrivers: serializedVehicles.filter(
          (vehicle) =>
            vehicle.ownershipType === VehicleOwnershipType.DRIVER_OWNED,
        ).length,
        pendingApplications: await this.applicationModel.countDocuments({
          branchId: branch._id,
          status: DriverApplicationStatus.PENDING,
        }),
      },
      drivers: serializedDrivers,
      vehicles: serializedVehicles,
    };
  }

  async createVehicleForBranchOwner(
    ownerId: string,
    dto: CreateBranchVehicleDto,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const code = dto.code.trim().toUpperCase();
    const defaults = this.vehicleCapacityDefaults(dto.type);

    const existingVehicle = await this.vehicleModel.findOne({ code }).exec();
    if (existingVehicle) {
      throw new ConflictException('A vehicle with this code already exists.');
    }

    const vehicle = await this.vehicleModel.create({
      code,
      plateNumber: dto.plateNumber?.trim() || null,
      type: dto.type,
      ownershipType: VehicleOwnershipType.COMPANY,
      branchId: branch._id,
      currentWarehouse: dto.currentWarehouse?.trim() || branch.name,
      status: dto.status ?? VehicleStatus.AVAILABLE,
      maxWeightKg: dto.maxWeightKg ?? defaults.maxWeightKg,
      maxVolumeM3: dto.maxVolumeM3 ?? null,
      maxPackageCount: dto.maxPackageCount ?? defaults.maxPackageCount,
      isActive: true,
    });

    return this.serializeVehicle(vehicle);
  }

  async updateVehicleForBranchOwner(
    vehicleId: string,
    ownerId: string,
    dto: UpdateBranchVehicleDto,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const vehicle = await this.vehicleModel.findById(vehicleId).exec();
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }
    if (vehicle.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This vehicle does not belong to your branch.',
      );
    }
    if (vehicle.ownershipType !== VehicleOwnershipType.COMPANY) {
      throw new BadRequestException(
        'Driver-owned vehicles cannot be edited from branch vehicle management.',
      );
    }
    const activeAssignment = await this.assignmentModel.findOne({
      vehicleId: vehicle._id,
      isActive: true,
    });
    const isAssigned = Boolean(activeAssignment);

    if (dto.plateNumber !== undefined) {
      vehicle.plateNumber = dto.plateNumber?.trim() || null;
    }
    if (dto.currentWarehouse !== undefined) {
      vehicle.currentWarehouse = dto.currentWarehouse?.trim() || null;
    }
    if (dto.status !== undefined) {
      if (isAssigned && dto.status !== VehicleStatus.IN_USE) {
        throw new BadRequestException(
          'Assigned vehicles stay in use until they are unassigned.',
        );
      }
      if (!isAssigned && dto.status === VehicleStatus.IN_USE) {
        throw new BadRequestException(
          'Only assigned vehicles can be marked as in use.',
        );
      }
      vehicle.status = dto.status;
    }
    if (dto.maxWeightKg !== undefined) {
      vehicle.maxWeightKg = dto.maxWeightKg ?? null;
    }
    if (dto.maxPackageCount !== undefined) {
      vehicle.maxPackageCount = dto.maxPackageCount ?? null;
    }
    if (isAssigned) {
      vehicle.status = VehicleStatus.IN_USE;
    }
    await vehicle.save();

    return this.serializeVehicle(vehicle);
  }

  async deactivateVehicleForBranchOwner(vehicleId: string, ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const vehicle = await this.vehicleModel.findById(vehicleId).exec();
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }
    if (vehicle.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This vehicle does not belong to your branch.',
      );
    }
    if (vehicle.ownershipType !== VehicleOwnershipType.COMPANY) {
      throw new BadRequestException(
        'Driver-owned vehicles cannot be deactivated from branch vehicle management.',
      );
    }

    const activeAssignment = await this.assignmentModel.findOne({
      vehicleId: vehicle._id,
      isActive: true,
    });
    if (activeAssignment) {
      throw new BadRequestException(
        'Unassign this vehicle before deactivating it.',
      );
    }

    vehicle.isActive = false;
    vehicle.status = VehicleStatus.INACTIVE;
    await vehicle.save();

    return { message: 'Vehicle deactivated successfully.' };
  }

  async activateVehicleForBranchOwner(vehicleId: string, ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const vehicle = await this.vehicleModel.findById(vehicleId).exec();
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }
    if (vehicle.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This vehicle does not belong to your branch.',
      );
    }
    if (vehicle.ownershipType !== VehicleOwnershipType.COMPANY) {
      throw new BadRequestException(
        'Driver-owned vehicles cannot be activated from branch vehicle management.',
      );
    }

    vehicle.isActive = true;
    if (vehicle.status === VehicleStatus.INACTIVE) {
      vehicle.status = VehicleStatus.AVAILABLE;
    }
    await vehicle.save();

    return { message: 'Vehicle activated successfully.' };
  }

  async updateDriverManagementForBranchOwner(
    driverId: string,
    ownerId: string,
    dto: UpdateDriverManagementDto,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const driver = await this.userModel.findById(driverId).exec();
    if (!driver) {
      throw new NotFoundException('Driver not found.');
    }
    if (
      driver.role !== Role.DRIVER ||
      driver.branchId?.toString() !== branch._id.toString()
    ) {
      throw new BadRequestException(
        'This driver does not belong to your branch.',
      );
    }
    if (driver.vehicleType === VehicleType.CAR) {
      throw new BadRequestException(
        'Car drivers are no longer supported in this portal.',
      );
    }

    if (dto.availabilityStatus != null) {
      driver.availabilityStatus = dto.availabilityStatus;
    }
    if (dto.licenseNumber !== undefined) {
      driver.licenseNumber = dto.licenseNumber?.trim() || null;
    }
    if (dto.licenseExpiry !== undefined) {
      driver.licenseExpiry = dto.licenseExpiry
        ? new Date(dto.licenseExpiry)
        : null;
    }
    if (dto.supportedVehicleTypes != null) {
      driver.supportedVehicleTypes = this.vehicleTypeList(
        dto.supportedVehicleTypes,
      );
    }
    if (dto.maxLoadWeightKg !== undefined) {
      driver.maxLoadWeightKg = dto.maxLoadWeightKg ?? null;
    }
    if (dto.maxPackageCount !== undefined) {
      driver.maxPackageCount = dto.maxPackageCount ?? null;
    }
    await driver.save();

    const assignments = await this.assignmentModel
      .find({ driverId: driver._id, isActive: true })
      .populate('vehicleId')
      .exec();

    return this.serializeDriver(driver, assignments);
  }

  async assignVehicleToDriverForBranchOwner(
    driverId: string,
    ownerId: string,
    dto: AssignDriverVehicleDto,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const [driver, vehicle] = await Promise.all([
      this.userModel.findById(driverId).exec(),
      this.vehicleModel.findById(dto.vehicleId).exec(),
    ]);

    if (!driver || driver.role !== Role.DRIVER) {
      throw new NotFoundException('Driver not found.');
    }
    if (driver.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This driver does not belong to your branch.',
      );
    }
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }
    if (vehicle.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This vehicle does not belong to your branch.',
      );
    }
    if (vehicle.ownershipType !== VehicleOwnershipType.COMPANY) {
      throw new BadRequestException(
        'Only branch-owned vehicles can be assigned from driver management.',
      );
    }
    if (!vehicle.isActive) {
      throw new BadRequestException('This vehicle is inactive.');
    }
    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new BadRequestException('Only available vehicles can be assigned.');
    }
    const activeVehicleAssignment = await this.assignmentModel.findOne({
      vehicleId: vehicle._id,
      isActive: true,
    });
    if (
      activeVehicleAssignment &&
      activeVehicleAssignment.driverId?.toString() !== driver._id.toString()
    ) {
      throw new BadRequestException(
        'This vehicle is already assigned to another driver.',
      );
    }
    const driverUsingVehicleCode = await this.userModel.findOne({
      _id: { $ne: driver._id },
      role: Role.DRIVER,
      branchId: branch._id,
      isActive: true,
      assignedVehicleCode: vehicle.code,
    });
    if (driverUsingVehicleCode) {
      throw new BadRequestException(
        'This vehicle is already assigned to another driver.',
      );
    }

    const currentAssignments = await this.assignmentModel
      .find({ driverId: driver._id, isActive: true })
      .populate('vehicleId')
      .exec();
    const hasLockedCityMotorcycle = currentAssignments.some((assignment) =>
      this.isDriverOwnedCityMotorcycle(
        assignment.vehicleId,
        driver._id.toString(),
      ),
    );
    if (hasLockedCityMotorcycle) {
      throw new BadRequestException(
        'City express riders keep their own motorcycle and cannot be reassigned to a branch vehicle here.',
      );
    }

    const assignmentType =
      dto.assignmentType ?? DriverVehicleAssignmentType.PRIMARY;

    if (assignmentType === DriverVehicleAssignmentType.PRIMARY) {
      for (const assignment of currentAssignments) {
        const previousVehicle = assignment.vehicleId as any;
        if (
          previousVehicle &&
          previousVehicle._id?.toString() !== vehicle._id.toString() &&
          previousVehicle.ownershipType === VehicleOwnershipType.COMPANY
        ) {
          previousVehicle.status = VehicleStatus.AVAILABLE;
          await previousVehicle.save();
        }
      }

      await this.assignmentModel.updateMany(
        { driverId: driver._id, isActive: true },
        { $set: { isActive: false, endedAt: new Date() } },
      );
      await this.assignmentModel.updateMany(
        {
          vehicleId: vehicle._id,
          assignmentType: DriverVehicleAssignmentType.PRIMARY,
          isActive: true,
        },
        { $set: { isActive: false, endedAt: new Date() } },
      );
      driver.assignedVehicleCode = vehicle.code;
      driver.vehicleType = vehicle.type;
    }

    if (!driver.supportedVehicleTypes?.length) {
      driver.supportedVehicleTypes = [vehicle.type];
    } else if (!driver.supportedVehicleTypes.includes(vehicle.type)) {
      driver.supportedVehicleTypes = [
        ...driver.supportedVehicleTypes,
        vehicle.type,
      ];
    }
    await driver.save();

    vehicle.status = VehicleStatus.IN_USE;
    await vehicle.save();

    await this.assignmentModel.create({
      driverId: driver._id,
      vehicleId: vehicle._id,
      assignmentType,
      assignedAt: new Date(),
      isActive: true,
    });

    const assignments = await this.assignmentModel
      .find({ driverId: driver._id, isActive: true })
      .populate('vehicleId')
      .exec();

    return this.serializeDriver(driver, assignments);
  }

  async unassignVehicleFromDriverForBranchOwner(
    driverId: string,
    ownerId: string,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const driver = await this.userModel.findById(driverId).exec();
    if (!driver || driver.role !== Role.DRIVER) {
      throw new NotFoundException('Driver not found.');
    }
    if (driver.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This driver does not belong to your branch.',
      );
    }

    const activeAssignments = await this.assignmentModel
      .find({ driverId: driver._id, isActive: true })
      .populate('vehicleId')
      .exec();

    if (!activeAssignments.length) {
      throw new BadRequestException('This driver has no assigned vehicle.');
    }
    if (
      activeAssignments.some((assignment) =>
        this.isDriverOwnedCityMotorcycle(
          assignment.vehicleId,
          driver._id.toString(),
        ),
      )
    ) {
      throw new BadRequestException(
        'City express riders keep their own motorcycle and cannot be unassigned here.',
      );
    }

    for (const assignment of activeAssignments) {
      assignment.isActive = false;
      assignment.endedAt = new Date();
      await assignment.save();

      const vehicle = assignment.vehicleId as any;
      if (vehicle && vehicle.isActive) {
        vehicle.status = VehicleStatus.AVAILABLE;
        await vehicle.save();
      }
    }

    driver.assignedVehicleCode = null;
    await driver.save();

    const assignments = await this.assignmentModel
      .find({ driverId: driver._id, isActive: true })
      .populate('vehicleId')
      .exec();

    return this.serializeDriver(driver, assignments);
  }

  async deactivateDriverForBranchOwner(driverId: string, ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const driver = await this.userModel.findById(driverId).exec();
    if (!driver || driver.role !== Role.DRIVER) {
      throw new NotFoundException('Driver not found.');
    }
    if (driver.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This driver does not belong to your branch.',
      );
    }

    const activeAssignments = await this.assignmentModel
      .find({ driverId: driver._id, isActive: true })
      .populate('vehicleId')
      .exec();

    for (const assignment of activeAssignments) {
      assignment.isActive = false;
      assignment.endedAt = new Date();
      await assignment.save();

      const vehicle = assignment.vehicleId as any;
      if (vehicle && vehicle.ownershipType === VehicleOwnershipType.COMPANY) {
        vehicle.status = VehicleStatus.AVAILABLE;
        await vehicle.save();
      } else if (
        vehicle &&
        vehicle.ownershipType === VehicleOwnershipType.DRIVER_OWNED
      ) {
        vehicle.status = VehicleStatus.INACTIVE;
        vehicle.isActive = false;
        await vehicle.save();
      }
    }

    await this.vehicleModel.updateMany(
      {
        ownerDriverId: driver._id,
        ownershipType: VehicleOwnershipType.DRIVER_OWNED,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
          status: VehicleStatus.INACTIVE,
        },
      },
    );

    driver.isActive = false;
    driver.availabilityStatus = DriverAvailabilityStatus.OFFLINE;
    driver.assignedVehicleCode = null;
    await driver.save();

    return { message: 'Driver removed from active roster.' };
  }

  async updateDriverVehicleTypeForBranchOwner(
    driverId: string,
    ownerId: string,
    vehicleType: VehicleType,
    assignedVehicleCode?: string,
  ) {
    const branch = await this.getBranchForOwner(ownerId);

    const driver = await this.userModel.findById(driverId).exec();
    if (!driver) {
      throw new NotFoundException('Driver not found.');
    }

    if (driver.role !== Role.DRIVER) {
      throw new BadRequestException(
        'Vehicle type can only be assigned to driver accounts.',
      );
    }

    if (driver.branchId?.toString() !== branch._id.toString()) {
      throw new BadRequestException(
        'This driver does not belong to your branch.',
      );
    }
    if (vehicleType === VehicleType.CAR) {
      throw new BadRequestException(
        'Car is no longer supported. Use motorcycle, truck, or large truck.',
      );
    }

    driver.vehicleType = vehicleType;
    driver.assignedVehicleCode = assignedVehicleCode?.trim() || null;
    await driver.save();

    const assignments = await this.assignmentModel
      .find({ driverId: driver._id, isActive: true })
      .populate('vehicleId')
      .exec();

    return this.serializeDriver(driver, assignments);
  }

  async approve(
    applicationId: string,
    reviewerId: string,
    dto: ApproveDriverApplicationDto,
  ) {
    const application = await this.applicationModel
      .findById(applicationId)
      .select('+passwordHash')
      .exec();
    if (!application) {
      throw new NotFoundException('Driver application not found.');
    }

    if (application.status !== DriverApplicationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending applications can be approved.',
      );
    }

    const [reviewerBranch, branch] = await Promise.all([
      this.branchModel.findOne({ ownerId: reviewerId }).exec(),
      this.branchModel.findById(application.branchId).exec(),
    ]);
    if (!branch) {
      throw new BadRequestException('Assigned branch no longer exists.');
    }
    if (
      !reviewerBranch ||
      reviewerBranch._id.toString() !== branch._id.toString()
    ) {
      throw new BadRequestException(
        'You can only approve applications for your own branch.',
      );
    }

    const [existingEmail, existingPhone] = await Promise.all([
      this.userModel.findOne({ email: application.email }).exec(),
      this.userModel.findOne({ phone: application.phone }).exec(),
    ]);

    if (existingEmail || existingPhone) {
      throw new ConflictException(
        'Cannot approve this application because the email or phone is already in use.',
      );
    }

    let finalVehicleType: VehicleType | null = null;
    let finalAssignedVehicleCode: string | null = null;
    if (application.vehicleType != null) {
      if (dto.vehicleType != null) {
        throw new BadRequestException(
          'Driver-owned applications should be approved without assigning a branch vehicle.',
        );
      }
      if (dto.assignedVehicleCode?.trim()) {
        throw new BadRequestException(
          'Driver-owned applications should not receive a branch vehicle code.',
        );
      }
      finalVehicleType = application.vehicleType;
    } else {
      if (
        dto.vehicleType != null &&
        dto.vehicleType !== VehicleType.TRUCK &&
        dto.vehicleType !== VehicleType.TRUCK_LARGE
      ) {
        throw new BadRequestException(
          'Branch-provided vehicle approvals currently support truck assignment only.',
        );
      }
      finalAssignedVehicleCode = dto.assignedVehicleCode?.trim() || null;
      finalVehicleType = dto.vehicleType ?? VehicleType.TRUCK;
    }
    const defaults = this.vehicleCapacityDefaults(finalVehicleType);

    const driverUser = await this.userModel.create({
      name: application.name,
      email: application.email,
      phone: application.phone,
      password: application.passwordHash,
      role: Role.DRIVER,
      vehicleType: finalVehicleType,
      assignedVehicleCode: finalAssignedVehicleCode,
      availabilityStatus: DriverAvailabilityStatus.OFFLINE,
      supportedVehicleTypes: finalVehicleType ? [finalVehicleType] : [],
      maxLoadWeightKg: defaults.maxWeightKg,
      maxPackageCount: defaults.maxPackageCount,
      isActive: true,
      avatarUrl: application.avatar.url,
      avatarPublicId: application.avatar.publicId,
      branchId: application.branchId,
    });

    if (application.vehicleType != null && finalVehicleType != null) {
      const ownVehicle = await this.vehicleModel.create({
        code: `DRV-${driverUser._id.toString().slice(-6).toUpperCase()}`,
        plateNumber: application.plateNumber ?? null,
        type: finalVehicleType,
        ownershipType: VehicleOwnershipType.DRIVER_OWNED,
        branchId: application.branchId,
        ownerDriverId: driverUser._id,
        currentWarehouse: branch.name,
        status: VehicleStatus.AVAILABLE,
        maxWeightKg: defaults.maxWeightKg,
        maxPackageCount: defaults.maxPackageCount,
        isActive: true,
      });
      await this.assignmentModel.create({
        driverId: driverUser._id,
        vehicleId: ownVehicle._id,
        assignmentType: DriverVehicleAssignmentType.PRIMARY,
        assignedAt: new Date(),
        isActive: true,
      });
      driverUser.assignedVehicleCode = null;
      await driverUser.save();
      application.assignedVehicleCode = null;
    } else if (finalAssignedVehicleCode) {
      let branchVehicle = await this.vehicleModel.findOne({
        code: finalAssignedVehicleCode,
      });
      if (!branchVehicle) {
        branchVehicle = await this.vehicleModel.create({
          code: finalAssignedVehicleCode,
          type: VehicleType.TRUCK,
          ownershipType: VehicleOwnershipType.COMPANY,
          branchId: application.branchId,
          currentWarehouse: branch.name,
          status: VehicleStatus.AVAILABLE,
          maxWeightKg: defaults.maxWeightKg,
          maxPackageCount: defaults.maxPackageCount,
          isActive: true,
        });
      }

      await this.assignmentModel.create({
        driverId: driverUser._id,
        vehicleId: branchVehicle._id,
        assignmentType: DriverVehicleAssignmentType.PRIMARY,
        assignedAt: new Date(),
        isActive: true,
      });
      branchVehicle.status = VehicleStatus.IN_USE;
      await branchVehicle.save();
    }

    application.vehicleType = finalVehicleType;
    application.assignedVehicleCode =
      application.assignedVehicleCode ?? finalAssignedVehicleCode;
    application.status = DriverApplicationStatus.APPROVED;
    application.reviewedBy = new Types.ObjectId(reviewerId);
    application.reviewedAt = new Date();
    application.rejectionReason = null;
    application.approvedUserId = driverUser._id;
    await application.save();

    await this.mailService.sendDriverApplicationApproved(
      application.email,
      application.name,
      branch.name,
    );

    return this.serializeApplication(
      await application.populate('branchId', 'name branchNumber address phone'),
    );
  }

  async reject(
    applicationId: string,
    reviewerId: string,
    dto: RejectDriverApplicationDto,
  ) {
    const application = await this.applicationModel
      .findById(applicationId)
      .exec();
    if (!application) {
      throw new NotFoundException('Driver application not found.');
    }

    if (application.status !== DriverApplicationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending applications can be rejected.',
      );
    }

    const [reviewerBranch, branch] = await Promise.all([
      this.branchModel.findOne({ ownerId: reviewerId }).exec(),
      this.branchModel.findById(application.branchId).exec(),
    ]);
    if (
      !branch ||
      !reviewerBranch ||
      reviewerBranch._id.toString() !== branch._id.toString()
    ) {
      throw new BadRequestException(
        'You can only reject applications for your own branch.',
      );
    }

    application.status = DriverApplicationStatus.REJECTED;
    application.reviewedBy = new Types.ObjectId(reviewerId);
    application.reviewedAt = new Date();
    application.rejectionReason = dto.reason?.trim() ?? null;
    await application.save();

    return this.serializeApplication(
      await application.populate('branchId', 'name branchNumber address phone'),
    );
  }

  private serializeApplication(application: any) {
    return {
      _id: application._id,
      name: application.name,
      email: application.email,
      phone: application.phone,
      vehicleType: this.normalizeVehicleType(application.vehicleType),
      assignedVehicleCode: application.assignedVehicleCode ?? null,
      plateNumber: application.plateNumber ?? null,
      status: application.status,
      branch:
        application.branchId && typeof application.branchId === 'object'
          ? {
              _id: application.branchId._id,
              name: application.branchId.name,
              branchNumber: application.branchId.branchNumber,
              address: application.branchId.address,
              phone: application.branchId.phone,
            }
          : null,
      avatarUrl: application.avatar?.url ?? null,
      cvUrl: application.cv?.url ?? null,
      nationalIdUrl: application.nationalId?.url ?? null,
      drivingLicenseUrl: application.drivingLicense?.url ?? null,
      rejectionReason: application.rejectionReason ?? null,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      reviewedAt: application.reviewedAt ?? null,
    };
  }
}
