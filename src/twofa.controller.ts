import { Controller, Post, Get, Body, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { TwoFAService } from './twofa.service';

@Controller('2fa')
export class TwoFAController {
  constructor(private readonly twoFAService: TwoFAService) {}

  @Post('generate')
  async generate(@Body('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId es requerido');
    }
    return this.twoFAService.generateSecret(userId);
  }

  @Post('verify')
  async verify(@Body('userId') userId: string, @Body('code') code: string) {
    if (!userId || !code) {
      throw new BadRequestException('userId y code son requeridos');
    }
    return this.twoFAService.verifyCode(userId, code);
  }

  @Post('disable')
  async disable(@Body('userId') userId: string, @Body('code') code: string) {
    if (!userId || !code) {
      throw new BadRequestException('userId y code son requeridos');
    }
    return this.twoFAService.disable2FA(userId, code);
  }

  @Post('status')
  async status(@Body('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId es requerido');
    }
    return this.twoFAService.check2FAStatus(userId);
  }
}
