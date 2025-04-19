import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { createClient } from '@supabase/supabase-js';
import * as qrcode from 'qrcode';

// Configuración del autenticador TOTP
authenticator.options = {
  window: 1, // Ventana de ±30 segundos
  step: 30, // Tiempo de validez del token
  digits: 6 // Longitud del token
};

const APP_NAME = 'EdgeTrader';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

@Injectable()
export class TwoFAService {
  /**
   * Genera un nuevo secreto TOTP para un usuario
   */
  async generateSecret(userId: string, clientIp?: string, userAgent?: string) {
    try {
      if (!userId) throw new BadRequestException('ID de usuario no proporcionado');

      const profile = await this.getUserProfile(userId);
      if (!profile) throw new BadRequestException('No se encontró el perfil del usuario');
      if (profile.is_2fa_enabled) throw new BadRequestException('El 2FA ya está habilitado');

      const secret = authenticator.generateSecret();
      const otpAuthUrl = authenticator.keyuri(userId, APP_NAME, secret);
      const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);

      await this.updateProfile(userId, {
        totp_secret: secret,
        is_2fa_enabled: false
      });

      return { success: true, secret, qr: qrCodeUrl, error: null };
    } catch (error: any) {
      return {
        success: false,
        secret: null,
        qr: null,
        error: error.message || 'Error al generar el secreto TOTP'
      };
    }
  }

  /**
   * Verifica un código TOTP
   */
  async verifyCode(userId: string, token: string) {
    try {
      if (!token?.match(/^\d{6}$/)) throw new BadRequestException('Formato de token inválido');

      const profile = await this.getUserProfile(userId);
      if (!profile?.totp_secret) throw new BadRequestException('No se encontró el secreto TOTP');

      const isValid = authenticator.verify({
        token,
        secret: profile.totp_secret
      });

      if (!isValid) throw new UnauthorizedException('Código inválido');

      if (!profile.is_2fa_enabled) {
        await this.updateProfile(userId, { is_2fa_enabled: true });
      }

      return { success: true, error: null };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error al verificar el código'
      };
    }
  }

  /**
   * Deshabilita el 2FA para un usuario
   */
  async disable2FA(userId: string, token: string) {
    try {
      const verifyResult = await this.verifyCode(userId, token);
      if (!verifyResult.success) {
        throw new UnauthorizedException(verifyResult.error || 'Código inválido');
      }

      await this.updateProfile(userId, {
        is_2fa_enabled: false,
        totp_secret: null
      });

      return { success: true, error: null };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error al desactivar 2FA'
      };
    }
  }

  async getUserProfile(userId: string) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_2fa_enabled, totp_secret')
      .eq('id', userId)
      .single();

    if (error) throw new BadRequestException(`Error al obtener el perfil: ${error.message}`);
    if (!profile) throw new BadRequestException('Perfil no encontrado');

    return profile;
  }

  // Métodos privados de utilidad

  private async updateProfile(userId: string, updates: Partial<{
    totp_secret: string | null,
    is_2fa_enabled: boolean
  }>) {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw new BadRequestException('Error al actualizar el perfil');
  }
}
