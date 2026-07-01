import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../common/enum/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { BranchLogisticsService } from './branch-logistics.service';
import { CalculateBranchLogisticsPriceDto } from './dto/calculate-branch-logistics-price.dto';
import { CreateBranchLogisticsPricingRuleDto } from './dto/create-branch-logistics-pricing-rule.dto';
import { CreateBranchLogisticsShipmentDto } from './dto/create-branch-logistics-shipment.dto';
import { AssignBranchLogisticsTripDto } from './dto/assign-branch-logistics-trip.dto';
import { QueryBranchLogisticsShipmentsDto } from './dto/query-branch-logistics-shipments.dto';
import { UpdateBranchLogisticsStatusDto } from './dto/update-branch-logistics-status.dto';

@Controller('branch-logistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BRANCH_OWNER)
export class BranchLogisticsController {
  constructor(
    private readonly branchLogisticsService: BranchLogisticsService,
  ) {}

  @Post('shipments')
  createShipment(
    @CurrentUser() user: any,
    @Body() dto: CreateBranchLogisticsShipmentDto,
  ) {
    return this.branchLogisticsService.createShipment(user._id.toString(), dto);
  }

  @Post('shipments/calculate-price')
  calculatePrice(
    @CurrentUser() user: any,
    @Body() dto: CalculateBranchLogisticsPriceDto,
  ) {
    return this.branchLogisticsService.calculatePrice({
      ...dto,
      senderBranchId: undefined,
    });
  }

  @Get('shipments')
  listShipments(
    @CurrentUser() user: any,
    @Query() query: QueryBranchLogisticsShipmentsDto,
  ) {
    return this.branchLogisticsService.listShipmentsForBranch(
      user._id.toString(),
      query,
    );
  }

  @Get('ticket-users')
  listTicketUsers(@Query('search') search?: string) {
    return this.branchLogisticsService.listTicketUsers(search);
  }

  @Get('customer/shipments')
  @Roles(Role.CUSTOMER)
  listCustomerShipments(@CurrentUser() user: any) {
    return this.branchLogisticsService.listShipmentsForCustomer(
      user._id.toString(),
    );
  }

  @Get('driver/assigned-shipments')
  @Roles(Role.DRIVER)
  listDriverAssignedShipments(@CurrentUser() user: any) {
    return this.branchLogisticsService.listAssignedShipmentsForDriver(
      user._id.toString(),
    );
  }

  @Patch('driver/shipments/:id/collect')
  @Roles(Role.DRIVER)
  collectDriverShipment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.collectAssignedShipmentForDriver(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Patch('driver/shipments/:id/deliver')
  @Roles(Role.DRIVER)
  dispatchDriverShipment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.dispatchAssignedShipmentForDriver(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Patch('driver/shipments/:id/arrive')
  @Roles(Role.DRIVER)
  arriveDriverShipment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.arriveAssignedShipmentForDriver(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Get('shipments/:id')
  getShipment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.branchLogisticsService.findShipmentForBranch(
      user._id.toString(),
      id,
    );
  }

  @Post('shipments/assign-trip')
  assignTrip(
    @CurrentUser() user: any,
    @Body() dto: AssignBranchLogisticsTripDto,
  ) {
    return this.branchLogisticsService.assignTripToDriver(
      user._id.toString(),
      dto,
    );
  }

  @Patch('shipments/:id/receive-at-sender')
  receiveAtSender(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.receiveAtSenderWarehouse(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Patch('shipments/:id/dispatch')
  dispatchShipment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.dispatchShipment(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Patch('shipments/:id/receive-at-destination')
  receiveAtDestination(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.receiveAtDestinationWarehouse(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Patch('shipments/:id/ready')
  markReady(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.markReadyForPickup(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Patch('shipments/:id/complete')
  completeShipment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.completeShipment(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Patch('shipments/:id/cancel')
  cancelShipment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchLogisticsStatusDto,
  ) {
    return this.branchLogisticsService.cancelShipment(
      user._id.toString(),
      id,
      dto,
    );
  }

  @Post('pricing-rules')
  createPricingRule(@Body() dto: CreateBranchLogisticsPricingRuleDto) {
    return this.branchLogisticsService.createPricingRule(dto);
  }

  @Get('pricing-rules')
  listPricingRules() {
    return this.branchLogisticsService.listPricingRules();
  }
}
