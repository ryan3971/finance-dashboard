/**
 * Base class for domain errors — transport-agnostic.
 *
 * Subclasses declare a `code` (a namespaced string constant) and an
 * `httpStatus` (the HTTP status the route layer should respond with).
 * The service throws a subclass; the error handler reads these properties
 * to build the response. Status codes never appear in service code.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
