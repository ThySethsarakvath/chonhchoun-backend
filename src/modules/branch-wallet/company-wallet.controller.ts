import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enum/role.enum';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { QueryBranchWalletTransactionsDto } from './dto/query-branch-wallet-transactions.dto';
import { BranchWalletService } from './branch-wallet.service';

@Controller('company-wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CompanyWalletController {
  constructor(private readonly branchWalletService: BranchWalletService) {}

  @Get()
  getCompanyWallet() {
    return this.branchWalletService.getCompanyWallet();
  }

  @Get('summary')
  getCompanyWalletSummary() {
    return this.branchWalletService.getCompanyWalletSummary();
  }

  @Get('transactions')
  getCompanyWalletTransactions(
    @Query() query: QueryBranchWalletTransactionsDto,
  ) {
    return this.branchWalletService.listCompanyTransactions(query);
  }
}
