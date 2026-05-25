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
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import { Role } from '../../common/enum/role.enum';
import { CloudinaryService } from '../database/cloudinary/cloudinary.service';
import { MailService } from '../mail/mail.service';
import { CreateDriverApplicationDto } from './dto/create-driver-application.dto';
import { RejectDriverApplicationDto } from './dto/reject-driver-application.dto';

@Injectable()
export class DriverApplicationsService {
  constructor(
    @InjectModel(DriverApplication.name)
    private readonly applicationModel: Model<DriverApplicationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
  ) {}

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

    if (!avatarFile || !cvFile || !nationalIdFile || !drivingLicenseFile) {
      throw new BadRequestException(
        'Avatar, CV, national ID, and driving license files are required.',
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
      this.cloudinaryService.uploadImage(avatarFile, 'chonhchoun/driver-applications/avatars'),
      this.cloudinaryService.uploadDocument(cvFile, 'chonhchoun/driver-applications/cv'),
      this.cloudinaryService.uploadDocument(
        nationalIdFile,
        'chonhchoun/driver-applications/national-id',
      ),
      this.cloudinaryService.uploadDocument(
        drivingLicenseFile,
        'chonhchoun/driver-applications/driving-license',
      ),
    ]);

    const application = await this.applicationModel.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone,
      passwordHash,
      branchId: branch._id,
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
      drivingLicense: {
        ...drivingLicense,
        originalName: drivingLicenseFile.originalname,
      },
      status: DriverApplicationStatus.PENDING,
    });

    return this.serializeApplication(
      await application.populate('branchId', 'name branchNumber address phone'),
    );
  }

  async listForBranchOwner(ownerId: string) {
    const branch = await this.branchModel.findOne({ ownerId }).exec();
    if (!branch) {
      throw new NotFoundException('No branch assigned to this branch owner.');
    }

    const applications = await this.applicationModel
      .find({ branchId: branch._id })
      .populate('branchId', 'name branchNumber address phone')
      .sort({ createdAt: -1 })
      .exec();

    return applications.map((application) => this.serializeApplication(application));
  }

  async listDriversForBranchOwner(ownerId: string) {
    const branch = await this.branchModel.findOne({ ownerId }).exec();
    if (!branch) {
      throw new NotFoundException('No branch assigned to this branch owner.');
    }

    const drivers = await this.userModel
      .find({
        role: Role.DRIVER,
        branchId: branch._id,
      })
      .sort({ createdAt: -1 })
      .exec();

    return drivers.map((driver) => ({
      _id: driver._id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      avatarUrl: driver.avatarUrl ?? null,
      isActive: driver.isActive,
      createdAt: (driver as any).createdAt,
    }));
  }

  async approve(applicationId: string, reviewerId: string) {
    const application = await this.applicationModel
      .findById(applicationId)
      .select('+passwordHash')
      .exec();
    if (!application) {
      throw new NotFoundException('Driver application not found.');
    }

    if (application.status !== DriverApplicationStatus.PENDING) {
      throw new BadRequestException('Only pending applications can be approved.');
    }

    const branch = await this.branchModel.findById(application.branchId).exec();
    if (!branch) {
      throw new BadRequestException('Assigned branch no longer exists.');
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

    const driverUser = await this.userModel.create({
      name: application.name,
      email: application.email,
      phone: application.phone,
      password: application.passwordHash,
      role: Role.DRIVER,
      isActive: true,
      avatarUrl: application.avatar.url,
      avatarPublicId: application.avatar.publicId,
      branchId: application.branchId,
    });

    application.status = DriverApplicationStatus.APPROVED;
    application.reviewedBy = new Types.ObjectId(reviewerId);
    application.reviewedAt = new Date();
    application.rejectionReason = null;
    application.approvedUserId = driverUser._id as Types.ObjectId;
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
    const application = await this.applicationModel.findById(applicationId).exec();
    if (!application) {
      throw new NotFoundException('Driver application not found.');
    }

    if (application.status !== DriverApplicationStatus.PENDING) {
      throw new BadRequestException('Only pending applications can be rejected.');
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
