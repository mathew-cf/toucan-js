import { Options as SentryOptions, Event as SentryEvent, Breadcrumb as SentryBreadcrumb, StackFrame } from "@sentry/types";
export declare type RewriteFrames = {
    root?: string;
    iteratee?: (frame: StackFrame) => StackFrame;
};
export declare type Options = {
    request: Request;
    waitUntil: (promise: Promise<any>) => void;
    dsn?: SentryOptions["dsn"];
    allowedCookies?: string[] | RegExp;
    allowedHeaders?: string[] | RegExp;
    allowedSearchParams?: string[] | RegExp;
    attachStacktrace?: SentryOptions["attachStacktrace"];
    beforeSend?: (event: Event) => Event;
    debug?: SentryOptions["debug"];
    environment?: SentryOptions["environment"];
    maxBreadcrumbs?: SentryOptions["maxBreadcrumbs"];
    pkg?: Record<string, any>;
    release?: SentryOptions["release"];
    rewriteFrames?: RewriteFrames;
    sampleRate?: SentryOptions["sampleRate"];
    transportOptions?: Compute<Pick<NonNullable<SentryOptions["transportOptions"]>, "headers">>;
};
export declare type Level = "fatal" | "error" | "warning" | "info" | "debug";
export declare type Breadcrumb = Compute<Omit<SentryBreadcrumb, "level"> & {
    level?: Level;
}>;
export declare type Event = Compute<Omit<SentryEvent, "level" | "breadcrumbs"> & {
    level?: Level;
    breadcrumbs?: Breadcrumb[];
}>;
/**
 * Force TS to load a type that has not been computed
 * (to resolve composed types that TS hasn't resolved).
 * https://pirix-gh.github.io/ts-toolbelt/modules/_any_compute_.html
 *
 * @example
 * // becomes {foo: string, baz: boolean}
 * type Foo = Compute<{bar: string} & {baz: boolean}>
 */
declare type Compute<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
} & {};
export {};
//# sourceMappingURL=types.d.ts.map