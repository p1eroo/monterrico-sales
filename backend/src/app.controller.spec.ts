import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('devuelve estado y nombre del servicio', () => {
      expect(appController.getRoot()).toEqual({
        status: 'ok',
        service: 'Monterrico CRM API',
      });
    });
  });
});
