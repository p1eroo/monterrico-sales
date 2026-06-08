import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const FACTILIZA_BASE = 'https://api.factiliza.com/v1';

export interface FactilizaRucData {
  numero: string;
  nombre_o_razon_social: string;
  tipo_contribuyente?: string;
  estado?: string;
  condicion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  direccion_completa?: string;
  ubigeo_sunat?: string;
  ubigeo?: string[];
}

interface FactilizaResponse<T> {
  status: number;
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable()
export class FactilizaService {
  constructor(private config: ConfigService) {}

  private getToken(): string {
    const token = this.config.get<string>('FACTILIZA_API_TOKEN');
    if (!token?.trim()) {
      throw new Error('FACTILIZA_API_TOKEN no está configurado');
    }
    return token;
  }

  private async fetchFromFactiliza<T>(path: string): Promise<T> {
    const token = this.getToken();
    const url = `${FACTILIZA_BASE}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = (await res.json()) as FactilizaResponse<T>;
    if (!res.ok || !body.success || !body.data) {
      const msg = body.message ?? `Error ${res.status} al consultar Factiliza`;
      throw new Error(msg);
    }
    return body.data as T;
  }

  async consultarRuc(ruc: string): Promise<FactilizaRucData> {
    const trimmed = ruc.replace(/\D/g, '').trim();
    if (!trimmed || trimmed.length !== 11) {
      throw new Error('El RUC debe tener 11 dígitos');
    }
    return this.fetchFromFactiliza<FactilizaRucData>(`/ruc/info/${trimmed}`);
  }
}
