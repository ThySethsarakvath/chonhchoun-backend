import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enum/role.enum';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { AgenciesRepository } from './agencies.repository';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class AgenciesService implements OnModuleInit {
  private readonly logger = new Logger(AgenciesService.name);

  constructor(
    private readonly agenciesRepository: AgenciesRepository,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  onModuleInit() {
    this.logger.log(' AgenciesService initialized successfully');
  }

  async getAdminOverview() {
    const [branches, agencies, agencyUsers, admins] = await Promise.all([
      this.agenciesRepository.countBranches(),
      this.agenciesRepository.countAgencies(),
      this.userModel.countDocuments({ role: Role.AGENCY }).exec(),
      this.userModel.countDocuments({ role: Role.ADMIN }).exec(),
    ]);

    return {
      branches,
      agencies,
      users: {
        agency: agencyUsers,
        admin: admins,
      },
    };
  }

  async createBranch(dto: CreateBranchDto) {
    const existing = await this.agenciesRepository.findBranchByCode(dto.code);
    if (existing) {
      throw new ConflictException('Branch code already exists.');
    }

    return this.agenciesRepository.createBranch({
      name: dto.name.trim(),
      code: dto.code,
      address: dto.address?.trim() ?? undefined, // Changed null to undefined
      description: dto.description?.trim() ?? undefined, // Changed null to undefined
      isActive: dto.isActive ?? true,
    });
  }

  async findAllBranches() {
    return this.agenciesRepository.findBranches();
  }

  async findBranchById(id: string) {
    this.ensureObjectId(id, 'branch');
    const branch = await this.agenciesRepository.findBranchById(id);
    if (!branch) throw new NotFoundException('Branch not found.');
    return branch;
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    await this.findBranchById(id);

    if (dto.code) {
      const existing = await this.agenciesRepository.findBranchByCode(dto.code);
      if (existing && existing._id.toString() !== id) {
        throw new ConflictException('Branch code already exists.');
      }
    }

    return this.agenciesRepository.updateBranch(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  async createAgency(dto: CreateAgencyDto) {
    const user = await this.validateAgencyUser(dto.userId);
    const branch = await this.findBranchById(dto.branchId);
    
    const agency = await this.agenciesRepository.createAgency({
      user: user._id as Types.ObjectId,
      branch: branch._id as Types.ObjectId,
      notes: dto.notes?.trim() ?? undefined, // Changed null to undefined
      isActive: true,
    });

    return this.agenciesRepository.findAgencyById((agency._id as Types.ObjectId).toString());
  }

  async findAllAgencies() {
    return this.agenciesRepository.findAgencies();
  }

  async findAgencyById(id: string) {
    this.ensureObjectId(id, 'agency');
    const agency = await this.agenciesRepository.findAgencyById(id);
    if (!agency) throw new NotFoundException('Agency not found.');
    return agency;
  }

  async updateAgency(id: string, dto: UpdateAgencyDto) {
    await this.findAgencyById(id);

    const payload: any = {};
    if (dto.userId) {
      const user = await this.validateAgencyUser(dto.userId);
      const existingAgency = await this.agenciesRepository.findAgencyByUserId(dto.userId);
      if (existingAgency && existingAgency._id.toString() !== id) {
        throw new ConflictException('Agency profile already exists for this user.');
      }
      payload.user = user._id;
    }

    if (dto.branchId) {
      const branch = await this.findBranchById(dto.branchId);
      payload.branch = branch._id;
    }

    if (dto.notes !== undefined) payload.notes = dto.notes.trim() || null;
    if (dto.isActive !== undefined) payload.isActive = dto.isActive;

    return this.agenciesRepository.updateAgency(id, payload);
  }

  private async validateAgencyUser(userId: string) {
    this.ensureObjectId(userId, 'user');
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found.');
    if (user.role !== Role.AGENCY) throw new BadRequestException('Selected user must have the agency role.');
    return user;
  }

  private ensureObjectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ${label} id.`);
    }
  }
}