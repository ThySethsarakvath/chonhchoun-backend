import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class InitiateRegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;
}