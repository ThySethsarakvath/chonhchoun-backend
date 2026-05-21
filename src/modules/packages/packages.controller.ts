import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto, UpdatePackageDto, ListPackagesQueryDto } from './dto/create-package.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('packages')
@UseGuards(JwtAuthGuard)
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: any,
    @Body() createPackageDto: CreatePackageDto,
  ) {
    return this.packagesService.create(user._id.toString(), createPackageDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @CurrentUser() user: any,
    @Query() query: ListPackagesQueryDto,
  ) {
    return this.packagesService.findAll(user._id.toString(), query);
  }


  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.packagesService.findOne(id, user._id.toString());
  }


  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updatePackageDto: UpdatePackageDto,
  ) {
    return this.packagesService.update(
      id,
      user._id.toString(),
      updatePackageDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.packagesService.remove(id, user._id.toString());
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submitForDelivery(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.packagesService.submitForDelivery(id, user._id.toString());
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.packagesService.cancel(id, user._id.toString());
  }
}
