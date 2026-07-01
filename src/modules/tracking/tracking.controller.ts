import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Max,
  Min,
} from 'class-validator';
import { MqttService, DriverLocationPayload } from '../mqtt/mqtt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '../../common/enum/role.enum';

class PublishLocationDto {
  @IsString()
  driverId: string;

  @IsString()
  deliveryId: string;

  @IsNumber() @Min(-90) @Max(90)
  latitude: number;

  @IsNumber() @Min(-180) @Max(180)
  longitude: number;

  @IsOptional() @IsNumber() @Min(0) @Max(360)
  heading?: number;

  @IsOptional() @IsNumber() @Min(0)
  speedKmh?: number;

  @IsOptional() @IsDateString()
  timestamp?: string;
}

@Controller('tracking')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingController {
  constructor(private readonly mqttService: MqttService) {}

  /**
   * POST /api/v1/tracking/location
   *
   * Called by the Flutter driver app to publish its GPS position.
   * The backend forwards the payload to the MQTT broker.
   * Flutter tracking screens subscribed to:
   *   chonhchoun/drivers/{driverId}/location
   * will receive the update in real time.
   *
   * In production, the Flutter driver app can publish directly to
   * the MQTT broker (port 1883) without going through this REST endpoint.
   * This REST bridge is useful for testing and for environments where
   * direct MQTT is blocked.
   */
  @Post('location')
  // @Roles(Role.DRIVER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  publishLocation(@Body() dto: PublishLocationDto) {
    const payload: DriverLocationPayload = {
      driverId:   dto.driverId,
      deliveryId: dto.deliveryId,
      latitude:   dto.latitude,
      longitude:  dto.longitude,
      heading:    dto.heading,
      speedKmh:   dto.speedKmh,
      timestamp:  dto.timestamp ?? new Date().toISOString(),
    };

    this.mqttService.publishDriverLocation(payload);

    return { message: 'Location published', topic: `chonhchoun/drivers/${dto.driverId}/location` };
  }
}