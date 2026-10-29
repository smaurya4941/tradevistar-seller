/**
 * The only platform globals the package may use: the fetch family, FormData, URLSearchParams,
 * timers and console. React Native and browsers both provide these. Deliberately absent: window,
 * document, localStorage, sessionStorage, URL.createObjectURL, atob/btoa and crypto — using any
 * of them is a compile error, which is the guarantee that this package runs on React Native.
 *
 * This file is for the package's own typecheck only; each app compiles the sources against its
 * platform's real type definitions.
 */

type HeadersInit = Headers | Record<string, string> | [string, string][];
type BodyInit = string | FormData | Blob | URLSearchParams | ArrayBuffer;
type RequestCredentials = "omit" | "same-origin" | "include";

interface Blob {
  readonly size: number;
  readonly type: string;
}
declare var Blob: { prototype: Blob };

interface Headers {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
  forEach(callback: (value: string, key: string) => void): void;
}
declare var Headers: { prototype: Headers; new (init?: HeadersInit): Headers };

interface RequestInit {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  credentials?: RequestCredentials;
  keepalive?: boolean;
  signal?: AbortSignal | null;
  cache?: string;
  mode?: string;
  redirect?: string;
}

interface Response {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  json(): Promise<unknown>;
  text(): Promise<string>;
  blob(): Promise<Blob>;
}
declare var Response: { prototype: Response };

interface AbortSignal {
  readonly aborted: boolean;
}

interface FormData {
  append(name: string, value: string | Blob, fileName?: string): void;
}
declare var FormData: { prototype: FormData; new (): FormData };

interface URLSearchParams {
  append(name: string, value: string): void;
  set(name: string, value: string): void;
  toString(): string;
}
declare var URLSearchParams: {
  prototype: URLSearchParams;
  new (init?: string | Record<string, string>): URLSearchParams;
};

declare function fetch(input: string, init?: RequestInit): Promise<Response>;
declare function setTimeout(handler: () => void, timeout?: number): unknown;
declare function clearTimeout(handle: unknown): void;

declare var console: {
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
