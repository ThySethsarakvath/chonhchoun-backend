import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enum/role.enum';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { AdminActivityService } from './admin-activity.service';
import { BranchesService } from '../branches/branches.service';
import { UpgradeBranchOwnerDto } from './dto/upgrade-branch-owner.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly branchesService: BranchesService,
    private readonly adminActivityService: AdminActivityService,
  ) {}

  private normalizeVehicleType(
    vehicleType: string | null | undefined,
  ): string | null {
    if (!vehicleType) return null;
    return vehicleType === 'TRUCK_SMALL' ? 'TRUCK' : vehicleType;
  }

  async findAllUsers() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map((user) => this.toAdminUser(user));
  }

  async upgradeBranchOwner(userId: string, dto: UpgradeBranchOwnerDto, actor?: any) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id.');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role !== Role.CUSTOMER) {
      throw new BadRequestException(
        'Only customer accounts can be upgraded to branch owner.',
      );
    }

    const existingBranch = await this.branchesService.findByOwnerId(user._id);
    if (existingBranch) {
      throw new ConflictException(
        'A branch already exists for this branch owner.',
      );
    }

    user.role = Role.BRANCH_OWNER;
    await user.save();

    const branch = await this.branchesService.createBranchForOwner(user, dto);

    await this.adminActivityService.log({
      action: 'branch_owner_upgraded',
      actor,
      targetUser: { _id: user._id as any, name: user.name },
      branch: {
        _id: branch._id as any,
        name: branch.name,
        branchNumber: branch.branchNumber,
      },
      details: `${actor?.name ?? 'Admin'} upgraded ${user.name} to branch owner.`,
    });

    await this.adminActivityService.log({
      action: 'branch_created',
      actor,
      targetUser: { _id: user._id as any, name: user.name },
      branch: {
        _id: branch._id as any,
        name: branch.name,
        branchNumber: branch.branchNumber,
      },
      details: `${branch.name} was created for ${user.name}.`,
    });

    return {
      user: this.toAdminUser(user),
      branch,
    };
  }

  async downgradeBranchOwner(userId: string, actor?: any) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id.');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role !== Role.BRANCH_OWNER) {
      throw new BadRequestException(
        'Only branch owner accounts can be downgraded.',
      );
    }

    const branch = await this.branchesService.suspendBranchByOwnerId(user._id);

    user.role = Role.CUSTOMER;
    await user.save();

    await this.adminActivityService.log({
      action: 'branch_owner_downgraded',
      actor,
      targetUser: { _id: user._id as any, name: user.name },
      branch: branch
          ? {
              _id: branch._id as any,
              name: branch.name,
              branchNumber: branch.branchNumber,
            }
          : undefined,
      details: `${actor?.name ?? 'Admin'} downgraded ${user.name} back to customer.`,
    });

    if (branch) {
      await this.adminActivityService.log({
        action: 'branch_closed',
        actor,
        targetUser: { _id: user._id as any, name: user.name },
        branch: {
          _id: branch._id as any,
          name: branch.name,
          branchNumber: branch.branchNumber,
        },
        details: `${branch.name} was closed.`,
      });
    }

    return {
      user: this.toAdminUser(user),
      branch,
    };
  }

  async migratePendingBranches() {
    return this.branchesService.migratePendingBranchesToActive();
  }

  async logManualBranchCreate(branch: any, actor?: any) {
    return this.adminActivityService.log({
      action: 'branch_created',
      actor,
      branch: {
        _id: branch?._id as any,
        name: branch?.name,
        branchNumber: branch?.branchNumber,
      },
      details: `${branch?.name ?? 'Branch'} was created.`,
    });
  }

  private toAdminUser(user: UserDocument) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      vehicleType: this.normalizeVehicleType(user.vehicleType),
      assignedVehicleCode: user.assignedVehicleCode ?? null,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      createdAt: (user as any).createdAt,
    };
  }
}
