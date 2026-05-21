import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('packages')
@UseGuards(JwtAuthGuard)
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  create(@Body() createPackageDto: CreatePackageDto, @CurrentUser() user: any) {
    return this.packagesService.create(createPackageDto, user._id);
  }

  @Get('my')
  findMy(@CurrentUser() user: any) {
    return this.packagesService.findMyPackages(user._id);
  }

  @Get('available')
  findAvailable() {
    return this.packagesService.findAvailable();
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.packagesService.acceptPackage(id, user._id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.packagesService.cancelPackage(id, user._id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagesService.findOne(id);
  }

  @Get()
  findAll() {
    return this.packagesService.findAll();
  }
}
