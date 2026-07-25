import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import {
  BranchWallet,
  BranchWalletDocument,
} from '../../shared/schemas/branch-wallet.schema';
import {
  BranchWalletTransaction,
  BranchWalletTransactionDocument,
} from '../../shared/schemas/branch-wallet-transaction.schema';
import {
  CompanyWallet,
  CompanyWalletDocument,
} from '../../shared/schemas/company-wallet.schema';
import {
  CompanyWalletTransaction,
  CompanyWalletTransactionDocument,
} from '../../shared/schemas/company-wallet-transaction.schema';
import { BranchWalletTransactionStatus } from '../../common/enum/branch-wallet-transaction-status.enum';
import { BranchWalletTransactionType } from '../../common/enum/branch-wallet-transaction-type.enum';
import { QueryBranchWalletTransactionsDto } from './dto/query-branch-wallet-transactions.dto';

@Injectable()
export class BranchWalletService {
  constructor(
    @InjectModel(BranchWallet.name)
    private readonly walletModel: Model<BranchWalletDocument>,
    @InjectModel(BranchWalletTransaction.name)
    private readonly transactionModel: Model<BranchWalletTransactionDocument>,
    @InjectModel(CompanyWallet.name)
    private readonly companyWalletModel: Model<CompanyWalletDocument>,
    @InjectModel(CompanyWalletTransaction.name)
    private readonly companyTransactionModel: Model<CompanyWalletTransactionDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async getBranchForOwner(ownerId: string) {
    const branch = await this.branchModel.findOne({ ownerId }).exec();
    if (!branch) {
      throw new NotFoundException('No branch assigned to this branch owner.');
    }
    return branch;
  }

  async getOrCreateWallet(branchId: Types.ObjectId | string) {
    const normalizedBranchId =
      typeof branchId === 'string' ? new Types.ObjectId(branchId) : branchId;

    let wallet = await this.walletModel
      .findOne({ branchId: normalizedBranchId })
      .exec();

    if (!wallet) {
      wallet = await this.walletModel.create({
        branchId: normalizedBranchId,
        availableBalance: 0,
        pendingBalance: 0,
        totalCredited: 0,
        totalDebited: 0,
        currency: 'USD',
      });
    }

    return wallet;
  }

  async getOrCreateCompanyWallet() {
    let wallet = await this.companyWalletModel
      .findOne({ walletKey: 'CHONHCHOUN_COMPANY_MAIN' })
      .exec();

    if (!wallet) {
      wallet = await this.companyWalletModel.create({
        walletKey: 'CHONHCHOUN_COMPANY_MAIN',
        availableBalance: 0,
        pendingBalance: 0,
        totalCredited: 0,
        totalDebited: 0,
        currency: 'USD',
      });
    }

    return wallet;
  }

  async creditBranch(params: {
    branchId: Types.ObjectId | string;
    amount: number;
    description: string;
    shipmentId?: Types.ObjectId | string | null;
    ticketNumber?: string | null;
    metadata?: Record<string, any>;
  }) {
    const wallet = await this.getOrCreateWallet(params.branchId);
    wallet.availableBalance += params.amount;
    wallet.totalCredited += params.amount;
    await wallet.save();

    return this.transactionModel.create({
      branchId: wallet.branchId,
      walletId: wallet._id,
      shipmentId: params.shipmentId ?? null,
      ticketNumber: params.ticketNumber ?? null,
      type: BranchWalletTransactionType.CREDIT,
      source: 'BRANCH_LOGISTICS',
      amount: params.amount,
      description: params.description,
      metadata: params.metadata ?? {},
    });
  }

  async debitBranch(params: {
    branchId: Types.ObjectId | string;
    amount: number;
    description: string;
    shipmentId?: Types.ObjectId | string | null;
    ticketNumber?: string | null;
    metadata?: Record<string, any>;
  }) {
    const wallet = await this.getOrCreateWallet(params.branchId);
    wallet.availableBalance = Math.max(wallet.availableBalance - params.amount, 0);
    wallet.totalDebited += params.amount;
    await wallet.save();

    return this.transactionModel.create({
      branchId: wallet.branchId,
      walletId: wallet._id,
      shipmentId: params.shipmentId ?? null,
      ticketNumber: params.ticketNumber ?? null,
      type: BranchWalletTransactionType.DEBIT,
      source: 'BRANCH_LOGISTICS',
      amount: params.amount,
      description: params.description,
      metadata: params.metadata ?? {},
    });
  }

  async createPendingCredit(params: {
    branchId: Types.ObjectId | string;
    amount: number;
    description: string;
    shipmentId?: Types.ObjectId | string | null;
    ticketNumber?: string | null;
    metadata?: Record<string, any>;
  }) {
    const wallet = await this.getOrCreateWallet(params.branchId);
    wallet.pendingBalance += params.amount;
    await wallet.save();

    return this.transactionModel.create({
      branchId: wallet.branchId,
      walletId: wallet._id,
      shipmentId: params.shipmentId ?? null,
      ticketNumber: params.ticketNumber ?? null,
      type: BranchWalletTransactionType.CREDIT,
      source: 'BRANCH_LOGISTICS',
      status: BranchWalletTransactionStatus.PENDING,
      amount: params.amount,
      description: params.description,
      metadata: params.metadata ?? {},
    });
  }

  async creditCompany(params: {
    amount: number;
    description: string;
    shipmentId?: Types.ObjectId | string | null;
    ticketNumber?: string | null;
    metadata?: Record<string, any>;
  }) {
    const wallet = await this.getOrCreateCompanyWallet();
    wallet.availableBalance += params.amount;
    wallet.totalCredited += params.amount;
    await wallet.save();

    return this.companyTransactionModel.create({
      walletId: wallet._id,
      shipmentId: params.shipmentId ?? null,
      ticketNumber: params.ticketNumber ?? null,
      type: BranchWalletTransactionType.CREDIT,
      source: 'BRANCH_LOGISTICS',
      amount: params.amount,
      description: params.description,
      metadata: params.metadata ?? {},
    });
  }

  async debitCompany(params: {
    amount: number;
    description: string;
    shipmentId?: Types.ObjectId | string | null;
    ticketNumber?: string | null;
    metadata?: Record<string, any>;
  }) {
    const wallet = await this.getOrCreateCompanyWallet();
    wallet.availableBalance = Math.max(wallet.availableBalance - params.amount, 0);
    wallet.totalDebited += params.amount;
    await wallet.save();

    return this.companyTransactionModel.create({
      walletId: wallet._id,
      shipmentId: params.shipmentId ?? null,
      ticketNumber: params.ticketNumber ?? null,
      type: BranchWalletTransactionType.DEBIT,
      source: 'BRANCH_LOGISTICS',
      amount: params.amount,
      description: params.description,
      metadata: params.metadata ?? {},
    });
  }

  async createPendingCompanyCredit(params: {
    amount: number;
    description: string;
    shipmentId?: Types.ObjectId | string | null;
    ticketNumber?: string | null;
    metadata?: Record<string, any>;
  }) {
    const wallet = await this.getOrCreateCompanyWallet();
    wallet.pendingBalance += params.amount;
    await wallet.save();

    return this.companyTransactionModel.create({
      walletId: wallet._id,
      shipmentId: params.shipmentId ?? null,
      ticketNumber: params.ticketNumber ?? null,
      type: BranchWalletTransactionType.CREDIT,
      source: 'BRANCH_LOGISTICS',
      status: BranchWalletTransactionStatus.PENDING,
      amount: params.amount,
      description: params.description,
      metadata: params.metadata ?? {},
    });
  }

  async createShipmentPendingTransactions(params: {
    shipmentId: Types.ObjectId | string;
    ticketNumber: string;
    senderBranchId: Types.ObjectId | string;
    receiverBranchId: Types.ObjectId | string;
    senderAmount: number;
    receiverAmount: number;
    companyAmount: number;
    senderPercent?: number;
    receiverPercent?: number;
    companyPercent?: number;
    metadata?: Record<string, any>;
  }) {
    const [senderTx, receiverTx, companyTx] = await Promise.all([
      this.createPendingCredit({
        branchId: params.senderBranchId,
        amount: params.senderAmount,
        shipmentId: params.shipmentId,
        ticketNumber: params.ticketNumber,
        description: `Pending sender revenue share for ${params.ticketNumber}`,
        metadata: {
          ...(params.metadata ?? {}),
          shipmentId: params.shipmentId,
          revenueShareRole: 'SENDER',
          revenueSharePercent: params.senderPercent ?? 10,
        },
      }),
      this.createPendingCredit({
        branchId: params.receiverBranchId,
        amount: params.receiverAmount,
        shipmentId: params.shipmentId,
        ticketNumber: params.ticketNumber,
        description: `Pending receiver revenue share for ${params.ticketNumber}`,
        metadata: {
          ...(params.metadata ?? {}),
          shipmentId: params.shipmentId,
          revenueShareRole: 'RECEIVER',
          revenueSharePercent: params.receiverPercent ?? 10,
        },
      }),
      this.createPendingCompanyCredit({
        amount: params.companyAmount,
        shipmentId: params.shipmentId,
        ticketNumber: params.ticketNumber,
        description: `Pending company revenue share for ${params.ticketNumber}`,
        metadata: {
          ...(params.metadata ?? {}),
          shipmentId: params.shipmentId,
          revenueShareRole: 'COMPANY',
          revenueSharePercent: params.companyPercent ?? 80,
        },
      }),
    ]);

    return { senderTx, receiverTx, companyTx };
  }

  async createShipmentRevenueTransactions(params: {
    shipmentId: Types.ObjectId | string;
    ticketNumber: string;
    senderBranchId: Types.ObjectId | string;
    receiverBranchId: Types.ObjectId | string;
    senderAmount: number;
    receiverAmount: number;
    companyAmount: number;
    senderPercent?: number;
    receiverPercent?: number;
    companyPercent?: number;
    metadata?: Record<string, any>;
  }) {
    const existingPostedTransactions = await this.transactionModel
      .find({
        shipmentId: params.shipmentId,
        source: 'BRANCH_LOGISTICS',
        status: BranchWalletTransactionStatus.POSTED,
        type: BranchWalletTransactionType.CREDIT,
      })
      .exec();
    const existingPostedCompanyTransaction = await this.companyTransactionModel
      .findOne({
        shipmentId: params.shipmentId,
        source: 'BRANCH_LOGISTICS',
        status: BranchWalletTransactionStatus.POSTED,
        type: BranchWalletTransactionType.CREDIT,
      })
      .exec();

    if (
      existingPostedTransactions.length > 0 &&
      existingPostedCompanyTransaction
    ) {
      const senderTx = existingPostedTransactions.find(
        (tx) => tx.metadata?.revenueShareRole === 'SENDER',
      );
      const receiverTx = existingPostedTransactions.find(
        (tx) => tx.metadata?.revenueShareRole === 'RECEIVER',
      );
      return { senderTx, receiverTx, companyTx: existingPostedCompanyTransaction };
    }

    const existingTransactions = await this.transactionModel
      .find({
        shipmentId: params.shipmentId,
        source: 'BRANCH_LOGISTICS',
        status: BranchWalletTransactionStatus.PENDING,
        type: BranchWalletTransactionType.CREDIT,
      })
      .exec();
    const existingCompanyPendingTransaction = await this.companyTransactionModel
      .findOne({
        shipmentId: params.shipmentId,
        source: 'BRANCH_LOGISTICS',
        status: BranchWalletTransactionStatus.PENDING,
        type: BranchWalletTransactionType.CREDIT,
      })
      .exec();

    if (existingTransactions.length > 0 || existingCompanyPendingTransaction) {
      const wallets = await Promise.all(
        existingTransactions.map((tx) => this.getOrCreateWallet(tx.branchId)),
      );

      for (let index = 0; index < existingTransactions.length; index += 1) {
        const tx = existingTransactions[index];
        const wallet = wallets[index];
        wallet.pendingBalance = Math.max(wallet.pendingBalance - tx.amount, 0);
        wallet.availableBalance += tx.amount;
        wallet.totalCredited += tx.amount;
        await wallet.save();

        tx.status = BranchWalletTransactionStatus.POSTED;
        await tx.save();
      }

      if (existingCompanyPendingTransaction) {
        const companyWallet = await this.getOrCreateCompanyWallet();
        companyWallet.pendingBalance = Math.max(
          companyWallet.pendingBalance - existingCompanyPendingTransaction.amount,
          0,
        );
        companyWallet.availableBalance += existingCompanyPendingTransaction.amount;
        companyWallet.totalCredited += existingCompanyPendingTransaction.amount;
        await companyWallet.save();

        existingCompanyPendingTransaction.status =
          BranchWalletTransactionStatus.POSTED;
        await existingCompanyPendingTransaction.save();
      }

      const senderTx = existingTransactions.find(
        (tx) => tx.metadata?.revenueShareRole === 'SENDER',
      );
      const receiverTx = existingTransactions.find(
        (tx) => tx.metadata?.revenueShareRole === 'RECEIVER',
      );
      return {
        senderTx,
        receiverTx,
        companyTx: existingCompanyPendingTransaction,
      };
    }

    const [senderTx, receiverTx, companyTx] = await Promise.all([
      this.creditBranch({
        branchId: params.senderBranchId,
        amount: params.senderAmount,
        shipmentId: params.shipmentId,
        ticketNumber: params.ticketNumber,
        description: `Sender revenue share for ${params.ticketNumber}`,
        metadata: {
          ...(params.metadata ?? {}),
          shipmentId: params.shipmentId,
          revenueShareRole: 'SENDER',
          revenueSharePercent: params.senderPercent ?? 10,
        },
      }),
      this.creditBranch({
        branchId: params.receiverBranchId,
        amount: params.receiverAmount,
        shipmentId: params.shipmentId,
        ticketNumber: params.ticketNumber,
        description: `Receiver revenue share for ${params.ticketNumber}`,
        metadata: {
          ...(params.metadata ?? {}),
          shipmentId: params.shipmentId,
          revenueShareRole: 'RECEIVER',
          revenueSharePercent: params.receiverPercent ?? 10,
        },
      }),
      this.creditCompany({
        amount: params.companyAmount,
        shipmentId: params.shipmentId,
        ticketNumber: params.ticketNumber,
        description: `Company revenue share for ${params.ticketNumber}`,
        metadata: {
          ...(params.metadata ?? {}),
          shipmentId: params.shipmentId,
          revenueShareRole: 'COMPANY',
          revenueSharePercent: params.companyPercent ?? 80,
        },
      }),
    ]);

    return { senderTx, receiverTx, companyTx };
  }

  async reverseShipmentRevenueTransactions(params: {
    shipmentId: Types.ObjectId | string;
    ticketNumber: string;
    reason?: string;
  }) {
    const postedCredits = await this.transactionModel
      .find({
        shipmentId: params.shipmentId,
        source: 'BRANCH_LOGISTICS',
        status: BranchWalletTransactionStatus.POSTED,
        type: BranchWalletTransactionType.CREDIT,
      })
      .exec();

    if (postedCredits.length === 0) {
      return [];
    }

    const reversalTransactions = await Promise.all(
      postedCredits.map((tx) =>
        this.debitBranch({
          branchId: tx.branchId,
          amount: tx.amount,
          shipmentId: tx.shipmentId,
          ticketNumber: tx.ticketNumber,
          description:
            params.reason ?? `Revenue reversal for cancelled ${params.ticketNumber}`,
          metadata: {
            ...(tx.metadata ?? {}),
            reversalOfTransactionId: tx._id,
          },
        }),
      ),
    );
    const companyPostedCredit = await this.companyTransactionModel
      .findOne({
        shipmentId: params.shipmentId,
        source: 'BRANCH_LOGISTICS',
        status: BranchWalletTransactionStatus.POSTED,
        type: BranchWalletTransactionType.CREDIT,
      })
      .exec();

    const companyReversal = companyPostedCredit
      ? await this.debitCompany({
          amount: companyPostedCredit.amount,
          shipmentId: companyPostedCredit.shipmentId,
          ticketNumber: companyPostedCredit.ticketNumber,
          description:
            params.reason ?? `Revenue reversal for cancelled ${params.ticketNumber}`,
          metadata: {
            ...(companyPostedCredit.metadata ?? {}),
            reversalOfTransactionId: companyPostedCredit._id,
          },
        })
      : null;

    for (const tx of postedCredits) {
      tx.metadata = {
        ...(tx.metadata ?? {}),
        reversed: true,
        reversedReason: params.reason ?? 'Shipment cancelled',
      };
      await tx.save();
    }
    if (companyPostedCredit) {
      companyPostedCredit.metadata = {
        ...(companyPostedCredit.metadata ?? {}),
        reversed: true,
        reversedReason: params.reason ?? 'Shipment cancelled',
      };
      await companyPostedCredit.save();
    }

    return companyReversal
      ? [...reversalTransactions, companyReversal]
      : reversalTransactions;
  }

  async voidShipmentPendingTransactions(
    shipmentId: Types.ObjectId | string,
    reason = 'Shipment cancelled',
  ) {
    const transactions = await this.transactionModel
      .find({
        shipmentId,
        source: 'BRANCH_LOGISTICS',
        status: BranchWalletTransactionStatus.PENDING,
        type: BranchWalletTransactionType.CREDIT,
      })
      .exec();

    for (const tx of transactions) {
      const wallet = await this.getOrCreateWallet(tx.branchId);
      wallet.pendingBalance = Math.max(wallet.pendingBalance - tx.amount, 0);
      await wallet.save();
      tx.status = BranchWalletTransactionStatus.VOID;
      tx.metadata = {
        ...(tx.metadata ?? {}),
        voidReason: reason,
      };
      await tx.save();
    }

    const companyTransaction = await this.companyTransactionModel
      .findOne({
        shipmentId,
        source: 'BRANCH_LOGISTICS',
        status: BranchWalletTransactionStatus.PENDING,
        type: BranchWalletTransactionType.CREDIT,
      })
      .exec();

    if (companyTransaction) {
      const companyWallet = await this.getOrCreateCompanyWallet();
      companyWallet.pendingBalance = Math.max(
        companyWallet.pendingBalance - companyTransaction.amount,
        0,
      );
      await companyWallet.save();
      companyTransaction.status = BranchWalletTransactionStatus.VOID;
      companyTransaction.metadata = {
        ...(companyTransaction.metadata ?? {}),
        voidReason: reason,
      };
      await companyTransaction.save();
    }

    return transactions;
  }

  async getWalletForBranchOwner(ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const wallet = await this.getOrCreateWallet(branch._id);
    return {
      branch: {
        _id: branch._id,
        name: branch.name,
        branchNumber: branch.branchNumber ?? null,
        code: branch.code ?? null,
      },
      wallet,
    };
  }

  async getWalletSummaryForBranchOwner(ownerId: string) {
    const branch = await this.getBranchForOwner(ownerId);
    const wallet = await this.getOrCreateWallet(branch._id);
    return {
      branchId: branch._id,
      availableBalance: wallet.availableBalance,
      pendingBalance: wallet.pendingBalance,
      totalCredited: wallet.totalCredited,
      totalDebited: wallet.totalDebited,
      currency: wallet.currency,
      netBalance: wallet.totalCredited - wallet.totalDebited,
    };
  }

  async getCompanyWallet() {
    return this.getOrCreateCompanyWallet();
  }

  async getCompanyWalletSummary() {
    const wallet = await this.getOrCreateCompanyWallet();
    return {
      walletKey: wallet.walletKey,
      availableBalance: wallet.availableBalance,
      pendingBalance: wallet.pendingBalance,
      totalCredited: wallet.totalCredited,
      totalDebited: wallet.totalDebited,
      currency: wallet.currency,
      netBalance: wallet.totalCredited - wallet.totalDebited,
    };
  }

  async listCompanyTransactions(query: QueryBranchWalletTransactionsDto) {
    const where: Record<string, any> = {};

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.$lte = new Date(query.dateTo);
    }

    return this.companyTransactionModel
      .find(where)
      .sort({ createdAt: -1 })
      .exec();
  }

  async listTransactionsForBranchOwner(
    ownerId: string,
    query: QueryBranchWalletTransactionsDto,
  ) {
    const branch = await this.getBranchForOwner(ownerId);
    const where: Record<string, any> = { branchId: branch._id };

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.$lte = new Date(query.dateTo);
    }

    return this.transactionModel.find(where).sort({ createdAt: -1 }).exec();
  }
}
