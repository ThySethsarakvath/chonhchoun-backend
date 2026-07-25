import {
  IsArray, IsMongoId, IsOptional, IsInt, Min, Max, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DispatchDto {
  // Source warehouse to dispatch from
  @IsMongoId()
  sourceBranchId: string;

  // Driver IDs to use. Must all be AVAILABLE and stationed at source branch.
  @IsArray()
  @IsMongoId({ each: true })
  driverIds: string[];

  // If omitted: all PENDING packages at this branch are used.
  // If provided: only these specific package IDs are dispatched.
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  packageIds?: string[];

  // Solver time limit in seconds (default 30)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(120)
  timeLimitSeconds?: number;

  // Whether to use time windows (morning/afternoon shifts)
  @IsOptional()
  @IsBoolean()
  useTimeWindows?: boolean;
}