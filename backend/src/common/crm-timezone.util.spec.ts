import { parseLimaDateTime, instantFromLimaDayAndTime } from './crm-timezone.util';

describe('parseLimaDateTime', () => {
  it('uses midnight Lima when time is omitted', () => {
    expect(parseLimaDateTime('2026-08-28').toISOString()).toBe(
      '2026-08-28T05:00:00.000Z',
    );
  });

  it('applies HH:mm as Lima local time', () => {
    expect(parseLimaDateTime('2026-08-28', '08:29').toISOString()).toBe(
      '2026-08-28T13:29:00.000Z',
    );
  });
});

describe('instantFromLimaDayAndTime', () => {
  it('reads the Lima calendar day from a stored dueDate instant', () => {
    const dueDate = parseLimaDateTime('2026-08-28');
    expect(instantFromLimaDayAndTime(dueDate, '08:29').toISOString()).toBe(
      '2026-08-28T13:29:00.000Z',
    );
  });
});
