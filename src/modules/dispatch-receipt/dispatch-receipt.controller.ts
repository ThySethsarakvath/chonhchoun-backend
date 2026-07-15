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
import { DispatchReceiptService } from './dispatch-receipt.service';
import { CreateDispatchReceiptDto } from './dto/create-dispatch-receipt.dto';
import { ConfirmStopReceiptDto } from './dto/confirm-stop-receipt.dto';
import { QueryDispatchReceiptsDto } from './dto/query-dispatch-receipts.dto';

@Controller('dispatch-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BRANCH_OWNER)
export class DispatchReceiptController {
  constructor(
    private readonly dispatchReceiptService: DispatchReceiptService,
  ) {}

  @Post()
  createReceipt(
    @CurrentUser() user: any,
    @Body() dto: CreateDispatchReceiptDto,
  ) {
    return this.dispatchReceiptService.createReceipt(
      user._id.toString(),
      dto,
    );
  }

  @Get()
  listOutboundReceipts(
    @CurrentUser() user: any,
    @Query() query: QueryDispatchReceiptsDto,
  ) {
    return this.dispatchReceiptService.listOutboundReceipts(
      user._id.toString(),
      query,
    );
  }

  @Get('inbound')
  listInboundReceipts(
    @CurrentUser() user: any,
    @Query() query: QueryDispatchReceiptsDto,
  ) {
    return this.dispatchReceiptService.listInboundReceipts(
      user._id.toString(),
      query,
    );
  }

  @Get(':id')
  getReceipt(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dispatchReceiptService.getReceipt(
      user._id.toString(),
      id,
    );
  }

  @Patch(':id/depart')
  departReceipt(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dispatchReceiptService.departReceipt(
      user._id.toString(),
      id,
    );
  }

  @Patch(':id/cancel')
  cancelReceipt(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dispatchReceiptService.cancelReceipt(
      user._id.toString(),
      id,
    );
  }

  @Post(':id/stops/:stopOrder/simulate-arrival')
  simulateArrival(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('stopOrder') stopOrder: string,
  ) {
    return this.dispatchReceiptService.simulateArrivalAtStop(
      user._id.toString(),
      id,
      parseInt(stopOrder, 10),
    );
  }

  @Patch(':id/stops/:stopOrder/confirm')
  confirmStop(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('stopOrder') stopOrder: string,
    @Body() dto: ConfirmStopReceiptDto,
  ) {
    return this.dispatchReceiptService.confirmStop(
      user._id.toString(),
      id,
      parseInt(stopOrder, 10),
      dto,
    );
  }
}
