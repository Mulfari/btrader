import { Controller, Post, Body, Headers, Req, HttpException, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request } from 'express';

interface CreateCheckoutDto {
  userId: string;
  amount: number;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-checkout')
  async createCheckout(@Body() body: CreateCheckoutDto) {
    try {
      return await this.paymentsService.createCheckoutSession(body.userId, body.amount);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: Request,
  ) {
    try {
      return await this.paymentsService.handleWebhook(signature, request.body);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
} 