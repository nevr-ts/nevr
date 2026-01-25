// =============================================================================
// NEXT.JS TYPE DECLARATIONS
// Type declarations for dynamically imported Next.js modules
// These are only used at compile time - actual modules are loaded at runtime
// =============================================================================

declare module "next/headers" {
  export interface CookieOptions {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: "lax" | "strict" | "none"
    maxAge?: number
    path?: string
    domain?: string
    expires?: Date
  }

  export interface Cookie {
    name: string
    value: string
  }

  export interface CookieStore {
    get(name: string): Cookie | undefined
    set(name: string, value: string, options?: CookieOptions): void
    delete(name: string): void
  }

  export function cookies(): Promise<CookieStore>
  export function headers(): Promise<Headers>
}

declare module "next/navigation" {
  export function redirect(url: string): never
  export function notFound(): never
  export function useRouter(): {
    push(url: string): void
    replace(url: string): void
    refresh(): void
    back(): void
    forward(): void
  }
  export function usePathname(): string
  export function useSearchParams(): URLSearchParams
}

declare module "next/server" {
  export class NextRequest extends Request {
    nextUrl: URL
    cookies: {
      get(name: string): { value: string } | undefined
      set(name: string, value: string): void
      delete(name: string): void
    }
  }

  export class NextResponse extends Response {
    static next(init?: ResponseInit): NextResponse
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse
    static rewrite(url: string | URL, init?: ResponseInit): NextResponse
    static json(body: unknown, init?: ResponseInit): NextResponse
    cookies: {
      get(name: string): { value: string } | undefined
      set(name: string, value: string): void
      delete(name: string): void
    }
  }
}
