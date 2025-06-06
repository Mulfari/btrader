import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
} 