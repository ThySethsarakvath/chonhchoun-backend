import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AgenciesService } from './agencies.service';

@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Post()
  async create(@Body() body: any) {
    return await this.agenciesService.create(body);
  }

  @Get()
  async findAll() {
    return await this.agenciesService.findAll();
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.agenciesService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.agenciesService.remove(id);
  }
}