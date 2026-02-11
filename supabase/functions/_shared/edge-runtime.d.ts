/**
 * Declaraciones mínimas para que el IDE (TypeScript del workspace) reconozca
 * el entorno Deno de Supabase Edge Functions. El runtime real es Deno.
 */
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

/** Cadena de query: métodos encadenables y al final maybeSingle() o then() (Promise). */
interface SupabaseSelectChain {
  eq(column: string, value: string | number | boolean): SupabaseSelectChain;
  is(column: string, value: null): SupabaseSelectChain;
  in(column: string, values: string[]): SupabaseSelectChain;
  order(column: string, opts: { ascending: boolean }): SupabaseSelectChain;
  limit(n: number): SupabaseSelectChain & {
    maybeSingle(): Promise<{ data: { system_prompt?: string } | null; error: Error | null }>;
    then(onfulfilled?: (r: { data: { content: string }[] | null; error: Error | null }) => unknown): Promise<unknown>;
  };
  maybeSingle(): Promise<{ data: { system_prompt?: string } | null; error: Error | null }>;
}
interface SupabaseQueryChain {
  select(columns: string): SupabaseSelectChain;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>
  ): { from(table: string): SupabaseQueryChain };
}

declare module "npm:@supabase/supabase-js@2" {
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>
  ): { from(table: string): SupabaseQueryChain };
}
