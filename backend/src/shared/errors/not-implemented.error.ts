/**
 * Marca contratos ainda não implementados (fase RED do TDD).
 * Nenhum `NotImplementedError` deve sobrar no código ao final da fase GREEN.
 */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`Not implemented: ${feature}`);
    this.name = 'NotImplementedError';
  }
}
