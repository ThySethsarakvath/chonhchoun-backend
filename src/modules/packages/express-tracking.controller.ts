import { Controller, Get, Param } from '@nestjs/common';
import { PackagesService } from './packages.service';

@Controller('express-deliveries')
export class ExpressTrackingController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get('recipient/:token')
  recipientTracking(@Param('token') token: string) {
    return this.packagesService.findRecipientTracking(token);
  }
}
