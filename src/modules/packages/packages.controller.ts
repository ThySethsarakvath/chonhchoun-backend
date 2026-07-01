import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, CancelBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enum/role.enum';

@Controller('packages')
@UseGuards(JwtAuthGuard) // all routes require auth
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // CUSTOMER routes
  // ─────────────────────────────────────────────────────────────────────────────

  // POST /api/v1/packages
  // Create a new delivery booking request
  @Post()
  @Roles(Role.CUSTOMER, Role.ADMIN)
  @UseGuards(RolesGuard)
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: any) {
    return this.packagesService.create(dto, user);
  }

  // GET /api/v1/packages/my
  // Customer sees their own bookings (paginated + filterable)
  @Get('my')
  getMyBookings(@CurrentUser() user: any, @Query() query: QueryBookingDto) {
    return this.packagesService.findMyBookings(user._id.toString(), query);
  }

  // GET /api/v1/packages/track/:trackingNumber
  // Public tracking — no auth required (customers share tracking links)
  @Get('track/:trackingNumber')
  track(@Param('trackingNumber') trackingNumber: string) {
    return this.packagesService.findByTrackingNumber(trackingNumber);
  }

  // GET /api/v1/packages/:id
  // Get single booking — customer sees own, admin sees all
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.packagesService.findOne(id, user);
  }

  // PATCH /api/v1/packages/:id
  // Update a PENDING booking (customer only, own bookings)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.packagesService.update(id, dto, user);
  }

  // PATCH /api/v1/packages/:id/cancel
  // Cancel a PENDING booking
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.packagesService.cancel(id, dto, user);
  }

  // GET /api/v1/packages
  // Admin: list all bookings with filters and pagination
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll(@Query() query: QueryBookingDto) {
    return this.packagesService.findAll(query);
  }

  // DELETE /api/v1/packages/:id
  // Admin: hard delete
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.packagesService.remove(id);
  }
}
