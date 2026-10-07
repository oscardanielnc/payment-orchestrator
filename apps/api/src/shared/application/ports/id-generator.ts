export abstract class IdGenerator {
  abstract uuid(): string;
  /** 128 random bits, URL-safe: for public capability URLs that must not be guessable. */
  abstract secureToken(): string;
}
