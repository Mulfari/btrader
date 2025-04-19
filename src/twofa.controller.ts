import { Controller, Post, Body, Req } from '@nestjs/common';
import { TwoFAService } from './twofa.service';

@Controller('2fa')
export class TwoFAController {
  constructor(private readonly twoFAService: TwoFAService) {}

  @Post('generate')
  async generate(@Body('userId') userId: string) {
    return this.twoFAService.generateSecret(userId);
  }

  @Post('verify')
  async verify(@Body('userId') userId: string, @Body('code') code: string) {
    return this.twoFAService.verifyCode(userId, code);
  }
}
