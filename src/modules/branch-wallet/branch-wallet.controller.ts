import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Role } from '../../common/enum/role.enum';
import { BranchWalletService } from './branch-wallet.service';
import { QueryBranchWalletTransactionsDto } from './dto/query-branch-wallet-transactions.dto';

@Controller('branch-wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BRANCH_OWNER)
export class BranchWalletController {
  constructor(private readonly branchWalletService: BranchWalletService) {}

  @Get('me')
  getMyWallet(@CurrentUser() user: any) {
    return this.branchWalletService.getWalletForBranchOwner(
      user._id.toString(),
    );
  }

  @Get('me/summary')
  getMyWalletSummary(@CurrentUser() user: any) {
    return this.branchWalletService.getWalletSummaryForBranchOwner(
      user._id.toString(),
    );
  }

  @Get('me/transactions')
  getMyTransactions(
    @CurrentUser() user: any,
    @Query() query: QueryBranchWalletTransactionsDto,
  ) {
    return this.branchWalletService.listTransactionsForBranchOwner(
      user._id.toString(),
      query,
    );
  }
}
