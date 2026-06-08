import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return {
      status: 'ok',
      service: 'Monterrico CRM API',
    };
  }
}
