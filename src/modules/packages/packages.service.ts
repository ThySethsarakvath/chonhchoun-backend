import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Package, PackageDocument } from './schemas/package.schema';
import { CreatePackageDto } from './dto/create-package.dto';

@Injectable()
export class PackagesService {
  constructor(
    @InjectModel(Package.name) private packageModel: Model<PackageDocument>,
    private configService: ConfigService,
  ) {}

  async create(createPackageDto: CreatePackageDto, senderId: any): Promise<Package> {
    try {
      console.log('Creating package for user:', senderId);
      console.log('Package Data:', createPackageDto);

      // Ensure senderId is a valid ObjectId
      const senderObjectId = typeof senderId === 'string' ? new Types.ObjectId(senderId) : senderId;

      const newPackage = new this.packageModel({
        ...createPackageDto,
        senderId: senderObjectId,
      });

      const savedPackage = await newPackage.save();
      console.log('Package saved successfully:', savedPackage._id);

      // Trigger AI mapping in background safely
      this.triggerAutoMapping(savedPackage).catch(err => 
        console.error('AutoMapping Trigger Error (Async):', err.message)
      );

      return savedPackage;
    } catch (error) {
      console.error('Package Creation Error:', error);
      if (error.name === 'ValidationError') {
        throw new BadRequestException(`Validation Failed: ${error.message}`);
      }
      throw new InternalServerErrorException(`Failed to create package: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Package> {
    const pkg = await this.packageModel.findById(id).populate('senderId', 'fullName phone').populate('driverId', 'fullName phone').exec();
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async findAll(): Promise<Package[]> {
    return this.packageModel.find().populate('senderId', 'fullName phone').exec();
  }

  async findMyPackages(userId: any): Promise<Package[]> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return this.packageModel.find({ senderId: userObjectId }).sort({ createdAt: -1 }).exec();
  }

  async findAvailable(): Promise<Package[]> {
    return this.packageModel.find({ status: 'searching' }).exec();
  }

  async acceptPackage(packageId: string, driverId: any): Promise<Package> {
    const pkg = await this.packageModel.findById(packageId);
    if (!pkg) throw new NotFoundException('Package not found');

    const driverObjectId = typeof driverId === 'string' ? new Types.ObjectId(driverId) : driverId;

    pkg.status = 'accepted';
    pkg.driverId = driverObjectId;
    await pkg.save();

    // Notify FastAPI
    this.notifyAcceptance(pkg, driverId.toString()).catch(err => 
      console.error('FastAPI Acceptance Notification Error:', err.message)
    );

    return pkg;
  }

  async cancelPackage(packageId: string, userId: any): Promise<Package> {
    const pkg = await this.packageModel.findById(packageId);
    if (!pkg) throw new NotFoundException('Package not found');

    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    if (pkg.senderId.toString() !== userObjectId.toString()) {
      throw new BadRequestException('You do not have permission to cancel this package');
    }

    if (pkg.status === 'delivered') {
      throw new BadRequestException('Cannot cancel a delivered package');
    }

    pkg.status = 'canceled';
    await pkg.save();

    return pkg;
  }

  private async triggerAutoMapping(pkg: PackageDocument) {
    const url = this.configService.get<string>('ETA_API_URL');
    const apiKey = this.configService.get<string>('ETA_API_KEY');

    if (!url || !apiKey) {
      console.warn('FastAPI URL or API Key missing, skipping automapping');
      return;
    }

    const payload = {
      accept_time: new Date().toISOString(),
      stops: [{
        order_id: pkg._id.toString(),
        accept_gps_lat: pkg.pickupLat,
        accept_gps_lng: pkg.pickupLng,
        delivery_gps_lat: pkg.dropoffLat,
        delivery_gps_lng: pkg.dropoffLng,
        accept_time: new Date().toISOString()
      }],
      drivers: [] 
    };

    try {
      const response = await fetch(`${url}/autoMaping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errText = await response.text();
        console.error(`FastAPI Error (${response.status}):`, errText);
        return;
      }

      const result = await response.json();
      console.log('FastAPI AutoMapping Result:', result);
    } catch (error) {
      console.error('Failed to call FastAPI AutoMapping:', error.message);
    }
  }

  private async notifyAcceptance(pkg: PackageDocument, driverId: string) {
    const url = this.configService.get<string>('ETA_API_URL');
    const apiKey = this.configService.get<string>('ETA_API_KEY');

    if (!url || !apiKey) return;

    const payload = {
      order_id: pkg._id.toString(),
      driver_id: driverId,
      timestamp: new Date().toISOString()
    };

    try {
      await fetch(`${url}/accept_delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Failed to notify FastAPI about acceptance:', error.message);
    }
  }
}
