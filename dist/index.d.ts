/**
 * Sentry client for Cloudflare Workers.
 * Adheres to https://docs.sentry.io/development/sdk-dev/overview/
 */
import { User } from "@sentry/types";
import { Options, Breadcrumb, Level } from "./types";
export declare class Toucan {
    /**
     * If an empty DSN is passed, we should treat it as valid option which signifies disabling the SDK.
     */
    private disabled;
    /**
     * Options passed to constructor. See Options type.
     */
    private options;
    /**
     * Full store endpoint with auth search params. Parsed from options.dsn.
     */
    private url;
    /**
     * Sentry user object.
     */
    private user?;
    /**
     * Sentry request object transformed from incoming event.request.
     */
    private request;
    /**
     * Sentry breadcrumbs array.
     */
    private breadcrumbs;
    /**
     * Sentry tags object.
     */
    private tags?;
    /**
     * Sentry extra object.
     */
    private extra?;
    /**
     * Used to override the Sentry default grouping.
     */
    private fingerprint?;
    constructor(options: Options);
    /**
     * Set key:value that will be sent as extra data with the event.
     *
     * @param key String key of extra
     * @param value String value of extra
     */
    setExtra(key: string, value: string): void;
    /**
     * Set an object that will be merged sent as extra data with the event.
     *
     * @param extras Extras context object to merge into current context.
     */
    setExtras(extras: Record<string, string>): void;
    /**
     * Set key:value that will be sent as tags data with the event.
     *
     * @param key String key of tag
     * @param value String value of tag
     */
    setTag(key: string, value: string): void;
    /**
     * Set an object that will be merged sent as tags data with the event.
     *
     * @param tags Tags context object to merge into current context.
     */
    setTags(tags: Record<string, string>): void;
    /**
     * Overrides the Sentry default grouping. See https://docs.sentry.io/data-management/event-grouping/sdk-fingerprinting/
     *
     * @param fingerprint Array of strings used to override the Sentry default grouping.
     */
    setFingerprint(fingerprint: string[]): void;
    /**
     * Records a new breadcrumb which will be attached to future events.
     *
     * Breadcrumbs will be added to subsequent events to provide more context on user's actions prior to an error or crash.
     * @param breadcrumb The breadcrum to record.
     */
    addBreadcrumb(breadcrumb: Breadcrumb): void;
    /**
     * Captures an exception event and sends it to Sentry.
     *
     * @param exception An exception-like object.
     * @returns The generated eventId, or undefined if event wasn't scheduled.
     */
    captureException(exception: unknown): string | undefined;
    /**
     * Captures a message event and sends it to Sentry.
     *
     * @param message The message to send to Sentry.
     * @param level Define the level of the message.
     * @returns The generated eventId, or undefined if event wasn't scheduled.
     */
    captureMessage(message: string, level?: Level): string | undefined;
    /**
     * Updates user context information for future events.
     *
     * @param user — User context object to be set in the current context. Pass null to unset the user.
     */
    setUser(user: User | null): void;
    /**
     * In Cloudflare Workers it’s not possible to read event.request's body after having generated a response (if you attempt to, it throws an exception).
     * Chances are that if you are interested in reporting request body to Sentry, you have already read the data (via request.json()/request.text()).
     * Use this method to set it in Sentry context.
  
     * @param body
     */
    setRequestBody(body: string): void;
    /**
     * Send data to Sentry.
     *
     * @param data Event data
     */
    private postEvent;
    /**
     * Builds event payload. Applies beforeSend.
     *
     * @param additionalData Additional data added to defaults.
     * @returns Event
     */
    private buildEvent;
    /**
     * Converts data from fetch event's Request to Sentry Request used in Sentry Event
     *
     * @param request FetchEvent Request
     * @returns Sentry Request
     */
    private toSentryRequest;
    /**
     * This SDK's implementation of beforeSend. If 'beforeSend' is not provided in options, this implementation will be applied.
     * This function is applied to all events before sending to Sentry.
     *
     * By default it:
     * 1. Removes all request headers (unless opts.allowedHeaders is provided - in that case the allowlist is applied)
     * 2. Removes all request cookies (unless opts.allowedCookies is provided- in that case the allowlist is applied)
     * 3. Removes all search params (unless opts.allowedSearchParams is provided- in that case the allowlist is applied)
     *
     * @param event
     * @returns Event
     */
    private beforeSend;
    /**
     * Helper function that applies 'allowlist' on 'obj' keys.
     *
     * @param obj
     * @param allowlist
     * @returns New object with allowed keys.
     */
    private applyAllowlist;
    /**
     * A number representing the seconds elapsed since the UNIX epoch.
     */
    private timestamp;
    /**
     * Builds Message as per https://develop.sentry.dev/sdk/event-payloads/message/, adds it to the event,
     * and sends it to Sentry. Inspired by https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/backend.ts.
     *
     * @param event
     */
    private reportMessage;
    /**
     * Builds Exception as per https://docs.sentry.io/development/sdk-dev/event-payloads/exception/, adds it to the event,
     * and sends it to Sentry. Inspired by https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/backend.ts.
     *
     * @param event
     * @param error
     */
    private reportException;
    /**
     * Builds Stacktrace as per https://docs.sentry.io/development/sdk-dev/event-payloads/stacktrace/
     *
     * @param error Error object.
     * @returns Stacktrace
     */
    private buildStackTrace;
    /**
     * Get the breadcrumbs. If the stack size exceeds MAX_BREADCRUMBS, returns the last MAX_BREADCRUMBS breadcrumbs.
     */
    private getBreadcrumbs;
    /**
     * Runs a callback if debug === true.
     * Use this to delay execution of debug logic, to ensure toucan doesn't burn I/O in non-debug mode.
     *
     * @param callback
     */
    private debug;
    private log;
    private warn;
    private error;
    /**
     * Reads and logs Response object from Sentry. Uses a clone, not the original, so the body can be used elsewhere.
     * Do not use without this.debug wrapper.
     *
     * @param originalResponse Response
     */
    private logResponse;
}
//# sourceMappingURL=index.d.ts.map