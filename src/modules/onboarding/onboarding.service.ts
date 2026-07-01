import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Onboarding,
  OnboardingDocument,
} from '../../shared/schemas/onboarding.schema';
import { CloudinaryService } from '../database/cloudinary/cloudinary.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectModel(Onboarding.name)
    private readonly onboardingModel: Model<OnboardingDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ── GET all active slides (public — Flutter calls this on app launch) ─────────
  async findAll(): Promise<OnboardingDocument[]> {
    return this.onboardingModel
      .find({ isActive: true })
      .sort({ order: 1 }) // returns slides in display order
      .exec();
  }

  // ── GET all slides including inactive (admin only) ───────────────────────────
  async findAllAdmin(): Promise<OnboardingDocument[]> {
    return this.onboardingModel.find().sort({ order: 1 }).exec();
  }

  // ── GET one ──────────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<OnboardingDocument> {
    const slide = await this.onboardingModel.findById(id).exec();
    if (!slide) throw new NotFoundException('Onboarding slide not found.');
    return slide;
  }

  async create(
    dto: CreateOnboardingDto,
    file: Express.Multer.File,
  ): Promise<OnboardingDocument> {
    if (!file) throw new BadRequestException('Image file is required.');
    if (dto.order === undefined) {
      const count = await this.onboardingModel.countDocuments();
      dto.order = count;
    }
    const { url, publicId } = await this.cloudinaryService.uploadImage(
      file,
      'chonhchoun/onboarding',
    );

    const slide = await this.onboardingModel.create({
      ...dto,
      imageUrl: url,
      imagePublicId: publicId,
    });

    this.logger.log(`Onboarding slide created: ${slide._id}`);
    return slide;
  }

  async update(
    id: string,
    dto: UpdateOnboardingDto,
  ): Promise<OnboardingDocument> {
    const slide = await this.onboardingModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!slide) throw new NotFoundException('Onboarding slide not found.');
    return slide;
  }

  // ── UPDATE image only (admin only) ──────────────────────────────────────────
  async updateImage(
    id: string,
    file: Express.Multer.File,
  ): Promise<OnboardingDocument> {
    if (!file) throw new BadRequestException('Image file is required.');

    const slide = await this.findOne(id);

    // Delete old image from Cloudinary first
    if (slide.imagePublicId) {
      await this.cloudinaryService.deleteImage(slide.imagePublicId);
    }

    // Upload new image
    const { url, publicId } = await this.cloudinaryService.uploadImage(
      file,
      'chonhchoun/onboarding',
    );

    const updated = await this.onboardingModel
      .findByIdAndUpdate(
        id,
        { imageUrl: url, imagePublicId: publicId },
        { new: true },
      )
      .exec();

    return updated!;
  }

  // ── DELETE (admin only) — also removes image from Cloudinary ─────────────────
  async remove(id: string): Promise<{ message: string }> {
    const slide = await this.findOne(id);

    if (slide.imagePublicId) {
      await this.cloudinaryService.deleteImage(slide.imagePublicId);
    }

    await this.onboardingModel.findByIdAndDelete(id).exec();
    this.logger.log(`Onboarding slide deleted: ${id}`);
    return { message: 'Onboarding slide deleted.' };
  }

  // ── REORDER slides (admin only) ──────────────────────────────────────────────
  async reorder(orderedIds: string[]): Promise<{ message: string }> {
    // Update each slide's order field based on its position in the array
    const updates = orderedIds.map((id, index) =>
      this.onboardingModel.findByIdAndUpdate(id, { order: index }).exec(),
    );
    await Promise.all(updates);
    return { message: 'Slides reordered successfully.' };
  }
}
