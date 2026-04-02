import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agency } from './schemas/agency.schema';

@Injectable()
export class AgenciesService {
  constructor(@InjectModel(Agency.name) private agencyModel: Model<Agency>) {}

  async create(data: any) {
    try {
      const newAgency = new this.agencyModel(data);
      return await newAgency.save();
    } catch (error) {
      throw new BadRequestException('Invalid data! Check service_type or status spelling.');
    }
  }

  async findAll() {
    return this.agencyModel.find().exec();
  }

  async findOne(id: string) {
    const agency = await this.agencyModel.findById(id).exec();
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  async update(id: string, data: any) {
    try {
      const updated = await this.agencyModel
        .findByIdAndUpdate(id, data, { new: true, runValidators: true })
        .exec();
      if (!updated) throw new NotFoundException('Agency not found');
      return updated;
    } catch (error) {
      throw new BadRequestException('Update failed! Check your input values.');
    }
  }

  async remove(id: string) {
    const result = await this.agencyModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Agency not found');
    return { message: 'Deleted' };
  }
}