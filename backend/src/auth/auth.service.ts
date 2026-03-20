import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  constructor(
    private httpService: HttpService,
    private jwtService: JwtService,
  ) {}

  async login(idacceso: string, contraseña: string) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          'https://rest.monterrico.app/api/Licencias/Login',
          { idacceso, contraseña },
          { headers: { 'Content-Type': 'application/json' } }
        )
      );

      // Ajusta según la respuesta real de la API Monterrico
      if (!data || data.error) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const payload = { sub: idacceso, ...data };
      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        user: data,
      };
    } catch (error) {
      if (error.response?.status === 401 || error.response?.data) {
        throw new UnauthorizedException('Credenciales inválidas');
      }
      throw new UnauthorizedException('Error al conectar con el servidor');
    }
  }
}