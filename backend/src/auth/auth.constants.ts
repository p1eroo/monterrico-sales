/**
 * Debe coincidir con JwtModule.register en auth.module.ts.
 * En producción define JWT_SECRET en .env (nunca subas el secreto real al repo).
 */
export const JWT_SECRET =
  process.env.JWT_SECRET ||
  '10b1adc60f3c0cacdae6496fad31932153c56cb55692d4736f4513d1b017c0e0';

/** Rondas bcrypt (auth + alta de usuarios). */
export const BCRYPT_ROUNDS = 10;
