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
      console.log('Iniciando generación de secreto para usuario:', userId);

      if (!userId) {
        throw new BadRequestException('ID de usuario no proporcionado');
      }

      // Verificar estado actual del 2FA
      const profile = await this.getUserProfile(userId);
      
      if (!profile) {
        throw new BadRequestException('No se encontró el perfil del usuario');
      }

      if (profile.is_2fa_enabled) {
        throw new BadRequestException('El 2FA ya está habilitado para este usuario');
      }

      // Generar nuevo secreto
      const secret = authenticator.generateSecret();
      const otpAuthUrl = this.generateOtpAuthUrl(userId, secret);
      const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);

      // Guardar el secreto
      await this.updateProfile(userId, {
        totp_secret: secret,
        is_2fa_enabled: false
      });

      console.log('Secreto generado exitosamente para usuario:', userId);

      return {
        success: true,
        secret,
        qr: qrCodeUrl,
        error: null
      };
    } catch (error: any) {
      console.error('Error detallado en generateSecret:', {
        userId,
        error: error.message,
        stack: error.stack
      });
      
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
  async verifyCode(userId: string, token: string, clientIp?: string, userAgent?: string) {
    try {
      // Validar formato del token
      if (!this.isValidTokenFormat(token)) {
        throw new BadRequestException('Formato de token inválido');
      }

      // Obtener perfil y verificar secreto
      const profile = await this.getUserProfile(userId);
      if (!profile.totp_secret) {
        throw new BadRequestException('No se encontró el secreto TOTP');
      }

      // Verificar token
      const isValid = authenticator.verify({
        token,
        secret: profile.totp_secret
      });

      // Registrar el intento
      await this.logVerificationAttempt(userId, 'verify', isValid, clientIp, userAgent);

      if (!isValid) {
        throw new UnauthorizedException('Código inválido');
      }

      // Activar 2FA si no está activo
      if (!profile.is_2fa_enabled) {
        await this.updateProfile(userId, { is_2fa_enabled: true });
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en verifyCode:', error);
      return {
        success: false,
        error: error.message || 'Error al verificar el código'
      };
    }
  }

  /**
   * Deshabilita el 2FA para un usuario
   */
  async disable2FA(userId: string, token: string, clientIp?: string, userAgent?: string) {
    try {
      const verifyResult = await this.verifyCode(userId, token, clientIp, userAgent);
      if (!verifyResult.success) {
        throw new UnauthorizedException(verifyResult.error || 'Código inválido');
      }

      // Deshabilitar 2FA
      await this.updateProfile(userId, {
        is_2fa_enabled: false,
        totp_secret: null
      });

      // Registrar la desactivación
      await this.logVerificationAttempt(userId, 'disable', true, clientIp, userAgent);

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en disable2FA:', error);
      return {
        success: false,
        error: error.message || 'Error al desactivar 2FA'
      };
    }
  }

  // Métodos privados de utilidad

  async getUserProfile(userId: string) {
    console.log('Obteniendo perfil para usuario:', userId);

    if (!userId) {
      throw new BadRequestException('ID de usuario no proporcionado');
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_2fa_enabled, totp_secret')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error al obtener perfil:', {
        userId,
        error: error.message,
        code: error.code,
        details: error.details
      });
      throw new BadRequestException(`Error al obtener el perfil del usuario: ${error.message}`);
    }

    if (!profile) {
      console.error('Perfil no encontrado para usuario:', userId);
      throw new BadRequestException('No se encontró el perfil del usuario');
    }

    console.log('Perfil obtenido exitosamente:', {
      userId,
      has2FA: profile.is_2fa_enabled
    });

    return profile;
  }

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

    if (error) {
      throw new BadRequestException('Error al actualizar el perfil');
    }
  }

  private async logVerificationAttempt(
    userId: string,
    type: 'verify' | 'disable',
    success: boolean,
    ip?: string,
    userAgent?: string
  ) {
    await supabase
      .from('totp_verification_logs')
      .insert({
        user_id: userId,
        verification_type: type,
        success,
        ip_address: ip,
        user_agent: userAgent
      });
  }

  private generateOtpAuthUrl(userId: string, secret: string): string {
    return authenticator.keyuri(userId, APP_NAME, secret);
  }

  private isValidTokenFormat(token: string): boolean {
    return Boolean(token && /^\d{6}$/.test(token));
  }
}
