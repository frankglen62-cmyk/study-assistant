import { RouteError } from '@/lib/http/route';

export function assertSupabaseResult(error: { message: string } | null, message: string) {
  if (error) {
    throw new RouteError(500, 'database_error', message, error.message);
  }
}

export function parseSingle<T>(value: unknown, parser: { parse: (input: unknown) => T }, message: string) {
  try {
    return parser.parse(value);
  } catch (error) {
    throw new RouteError(500, 'invalid_database_shape', message, error);
  }
}

export function parseArray<T>(value: unknown, parser: { array: () => { parse: (input: unknown) => T[] } }, message: string) {
  try {
    return parser.array().parse(value);
  } catch (error) {
    throw new RouteError(500, 'invalid_database_shape', message, error);
  }
}
