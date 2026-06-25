import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DriverVehicleAssignmentType } from '../../common/enum/driver-vehicle-assignment-type.enum';

export type DriverVehicleAssignmentDocument = DriverVehicleAssignment &
  Document;

@Schema({ timestamps: true })
export class DriverVehicleAssignment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  driverId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vehicle', required: true })
  vehicleId: Types.ObjectId;

  @Prop({
    type: String,
    enum: DriverVehicleAssignmentType,
    default: DriverVehicleAssignmentType.PRIMARY,
  })
  assignmentType: DriverVehicleAssignmentType;

  @Prop({ type: Date, default: Date.now })
  assignedAt: Date;

  @Prop({ type: Date, default: null })
  endedAt?: Date | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const DriverVehicleAssignmentSchema = SchemaFactory.createForClass(
  DriverVehicleAssignment,
);

DriverVehicleAssignmentSchema.index({ driverId: 1, isActive: 1 });
DriverVehicleAssignmentSchema.index({ vehicleId: 1, isActive: 1 });
