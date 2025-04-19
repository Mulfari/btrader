import { Controller, Post, Body, UseGuards, Req, InternalServerErrorException } from '@nestjs/common';
import { TwoFAService } from './twofa.service';
import { AuthGuard } from './auth.guard';
import { Request } from 'express';
import { CheckStatusDto } from './2fa/dto/check-status.dto';

@Controller('2fa')
@UseGuards(AuthGuard)
export class TwoFAController {
  constructor(private readonly twoFAService: TwoFAService) {}

  @Post('generate')
  async generateSecret(@Body('userId') userId: string, @Req() request: Request) {
    const clientIp = request.ip;
    const userAgent = request.headers['user-agent'];
    return this.twoFAService.generateSecret(userId, clientIp, userAgent);
  }

  @Post('verify')
  async verifyCode(
    @Body('userId') userId: string,
    @Body('token') token: string,
    @Req() request: Request
  ) {
    const clientIp = request.ip;
    const userAgent = request.headers['user-agent'];
    return this.twoFAService.verifyCode(userId, token, clientIp, userAgent);
  }

  @Post('disable')
  async disable2FA(
    @Body('userId') userId: string,
    @Body('token') token: string,
    @Req() request: Request
  ) {
    const clientIp = request.ip;
    const userAgent = request.headers['user-agent'];
    return this.twoFAService.disable2FA(userId, token, clientIp, userAgent);
  }

  @Post('status')
  async check2FAStatus(@Body() { userId }: CheckStatusDto) {
    try {
      const profile = await this.twoFAService.getUserProfile(userId);
      return { is2FAEnabled: profile.is_2fa_enabled };
    } catch {
      throw new InternalServerErrorException('No se pudo obtener el estado de 2FA');
    }
  }
}
