import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
} 