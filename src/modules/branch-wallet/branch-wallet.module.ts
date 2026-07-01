import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../../shared/schemas/branch.schema';
import {
  BranchWallet,
  BranchWalletSchema,
} from '../../shared/schemas/branch-wallet.schema';
import {
  BranchWalletTransaction,
  BranchWalletTransactionSchema,
} from '../../shared/schemas/branch-wallet-transaction.schema';
import {
  CompanyWallet,
  CompanyWalletSchema,
} from '../../shared/schemas/company-wallet.schema';
import {
  CompanyWalletTransaction,
  CompanyWalletTransactionSchema,
} from '../../shared/schemas/company-wallet-transaction.schema';
import { BranchWalletController } from './branch-wallet.controller';
import { BranchWalletService } from './branch-wallet.service';
import { CompanyWalletController } from './company-wallet.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: BranchWallet.name, schema: BranchWalletSchema },
      {
        name: BranchWalletTransaction.name,
        schema: BranchWalletTransactionSchema,
      },
      { name: CompanyWallet.name, schema: CompanyWalletSchema },
      {
        name: CompanyWalletTransaction.name,
        schema: CompanyWalletTransactionSchema,
      },
    ]),
  ],
  controllers: [BranchWalletController, CompanyWalletController],
  providers: [BranchWalletService],
  exports: [BranchWalletService],
})
export class BranchWalletModule {}
