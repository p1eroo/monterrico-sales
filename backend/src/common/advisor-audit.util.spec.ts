import {
  buildAdvisorIdentityIndex,
  buildAdvisorStepFunction,
  resolveAdvisorAuditValue,
} from './advisor-audit.util';

const lila = { id: 'cmnq78i0y000x2yvqtukpqp88', name: 'Lila Borges' };
const maria = { id: 'cmnq78ytb000z2yvqtdhbv5mz', name: 'Maria Delgado' };
const index = buildAdvisorIdentityIndex([lila, maria]);

describe('resolveAdvisorAuditValue', () => {
  it('keeps a real user id', () => {
    expect(resolveAdvisorAuditValue(lila.id, index)).toBe(lila.id);
  });

  it('maps a unique display name to the user id', () => {
    expect(resolveAdvisorAuditValue('Lila Borges', index)).toBe(lila.id);
    expect(resolveAdvisorAuditValue('maria delgado', index)).toBe(maria.id);
  });

  it('drops bulk-reassign company-name lists', () => {
    expect(
      resolveAdvisorAuditValue(
        'ac farma laboratorios, Colegio Peruano Britanico, … (+13 más)',
        index,
      ),
    ).toBe('');
  });

  it('drops unknown text instead of treating it as an advisor id', () => {
    expect(resolveAdvisorAuditValue('ac farma laboratorios', index)).toBe('');
    expect(resolveAdvisorAuditValue('lead', index)).toBe('');
  });

  it('keeps an orphan user id that is no longer in the index', () => {
    expect(resolveAdvisorAuditValue('cmo7fe14608vj457dpwb2tr3m', index)).toBe(
      'cmo7fe14608vj457dpwb2tr3m',
    );
  });
});

describe('buildAdvisorStepFunction', () => {
  const createdAt = new Date('2026-06-04T00:00:00.000Z');
  const bulkAt = new Date('2026-08-11T19:57:50.000Z');
  const now = new Date('2026-08-21T18:00:00.000Z');

  it('does not fall back to etapa slug lead when assignedTo is empty', () => {
    const fn = buildAdvisorStepFunction(createdAt, '', [], index);
    expect(fn(now)).toBe('');
  });

  it('puts bulk-reassigned companies under the named advisor, not desconocido', () => {
    const fn = buildAdvisorStepFunction(
      createdAt,
      lila.id,
      [
        {
          at: bulkAt,
          oldValue: 'ac farma laboratorios',
          newValue: 'Lila Borges',
        },
      ],
      index,
    );
    expect(fn(now)).toBe(lila.id);
  });

  it('still follows id-to-id audits', () => {
    const fn = buildAdvisorStepFunction(
      createdAt,
      maria.id,
      [
        {
          at: new Date('2026-07-02T00:00:00.000Z'),
          oldValue: lila.id,
          newValue: maria.id,
        },
      ],
      index,
    );
    expect(fn(new Date('2026-06-15T00:00:00.000Z'))).toBe(lila.id);
    expect(fn(now)).toBe(maria.id);
  });
});
