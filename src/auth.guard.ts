import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { Request } from 'express';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Permitir siempre peticiones preflight OPTIONS para CORS
    if (request.method === 'OPTIONS') {
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException({
        message: 'Token no proporcionado',
        error: 'No se encontró el token Bearer en el header Authorization'
      });
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        throw new UnauthorizedException({
          message: 'Token inválido',
          error: error?.message || 'No se pudo validar el token con Supabase'
        });
      }

      // Agregar el usuario a la request para uso posterior
      request['user'] = user;
      return true;
    } catch (error: any) {
      throw new UnauthorizedException({
        message: 'Error al validar el token',
        error: error?.message || 'Error interno al validar el token'
      });
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
} 