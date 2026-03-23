import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta o controlador como pública (sin Bearer JWT). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
