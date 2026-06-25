import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  Package,
  PackageDocument,
} from '../../shared/schemas/package.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Package.name)
    private readonly packageModel: Model<PackageDocument>,
  ) {}

  /**
   * Ensures `userId` is allowed to access `packageId`'s conversation —
   * i.e. they are either the customer or the assigned driver on that package.
   * Returns the package on success; throws otherwise.
   */
  async assertParticipant(
    packageId: string,
    userId: string,
  ): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new NotFoundException('Package not found');
    }

    const pkg = await this.packageModel
      .findById(packageId)
      .select('customerId driverId')
      .exec();
    if (!pkg) throw new NotFoundException('Package not found');

    const isCustomer = String(pkg.customerId) === userId;
    const isDriver = pkg.driverId != null && String(pkg.driverId) === userId;
    if (!isCustomer && !isDriver) {
      throw new ForbiddenException('Not a participant of this delivery');
    }

    return pkg;
  }

  async saveMessage(
    packageId: string,
    senderId: string,
    text: string,
  ): Promise<MessageDocument> {
    return this.messageModel.create({
      packageId: new Types.ObjectId(packageId),
      senderId: new Types.ObjectId(senderId),
      text: text.trim(),
    });
  }

  /** Chronological message history for a package (caller must be a participant). */
  async getHistory(
    packageId: string,
    userId: string,
  ): Promise<MessageDocument[]> {
    await this.assertParticipant(packageId, userId);
    return this.messageModel
      .find({ packageId: new Types.ObjectId(packageId) })
      .sort({ createdAt: 1 })
      .exec();
  }
}
