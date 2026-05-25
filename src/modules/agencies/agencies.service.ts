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
import { CreateBranchDto } from './dto/create-branch.dto';
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
    const [branches, admins] = await Promise.all([
      this.agenciesRepository.countBranches(),
      this.userModel.countDocuments({ role: Role.ADMIN }).exec(),
    ]);

    return {
      branches,
      users: {
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

    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;

    if (hasLatitude != hasLongitude) {
      throw new BadRequestException(
        'Latitude and longitude must be provided together.',
      );
    }

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
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(hasLatitude && hasLongitude
          ? {
              latitude: dto.latitude,
              longitude: dto.longitude,
              location: {
                lat: dto.latitude!,
                lng: dto.longitude!,
              },
            }
          : {}),
    });
  }

  private ensureObjectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ${label} id.`);
    }
  }
}
