'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var core = require('@sentry/core');
var utils = require('@sentry/utils');
var uuid = require('uuid');
var cookie = require('cookie');
var stacktraceJs = require('stacktrace-js');

class Toucan {
    constructor(options) {
        this.options = options;
        if (!options.dsn || options.dsn.length === 0) {
            // If an empty DSN is passed, we should treat it as valid option which signifies disabling the SDK.
            this.url = "";
            this.disabled = true;
            this.debug(() => this.log("dsn missing, SDK is disabled"));
        }
        else {
            this.url = new core.API(options.dsn).getStoreEndpointWithUrlEncodedAuth();
            this.disabled = false;
            this.debug(() => this.log(`dsn parsed, full store endpoint: ${this.url}`));
        }
        this.user = undefined;
        this.request = this.toSentryRequest(options.request);
        this.breadcrumbs = [];
        this.tags = undefined;
        this.extra = undefined;
        this.fingerprint = undefined;
        this.beforeSend = this.beforeSend.bind(this);
        /**
         * Wrap all class methods in a proxy that:
         * 1. Wraps all code in try/catch to handle internal erros gracefully.
         * 2. Prevents execution if disabled = true
         */
        return new Proxy(this, {
            get: (target, key, receiver) => {
                return (...args) => {
                    if (this.disabled)
                        return;
                    try {
                        return Reflect.get(target, key, receiver).apply(target, args);
                    }
                    catch (err) {
                        this.debug(() => this.error(err));
                    }
                };
            },
        });
    }
    /**
     * Set key:value that will be sent as extra data with the event.
     *
     * @param key String key of extra
     * @param value String value of extra
     */
    setExtra(key, value) {
        if (!this.extra) {
            this.extra = {};
        }
        this.extra[key] = value;
    }
    /**
     * Set an object that will be merged sent as extra data with the event.
     *
     * @param extras Extras context object to merge into current context.
     */
    setExtras(extras) {
        this.extra = { ...this.extra, ...extras };
    }
    /**
     * Set key:value that will be sent as tags data with the event.
     *
     * @param key String key of tag
     * @param value String value of tag
     */
    setTag(key, value) {
        if (!this.tags) {
            this.tags = {};
        }
        this.tags[key] = value;
    }
    /**
     * Set an object that will be merged sent as tags data with the event.
     *
     * @param tags Tags context object to merge into current context.
     */
    setTags(tags) {
        this.tags = { ...this.tags, ...tags };
    }
    /**
     * Overrides the Sentry default grouping. See https://docs.sentry.io/data-management/event-grouping/sdk-fingerprinting/
     *
     * @param fingerprint Array of strings used to override the Sentry default grouping.
     */
    setFingerprint(fingerprint) {
        this.fingerprint = fingerprint;
    }
    /**
     * Records a new breadcrumb which will be attached to future events.
     *
     * Breadcrumbs will be added to subsequent events to provide more context on user's actions prior to an error or crash.
     * @param breadcrumb The breadcrum to record.
     */
    addBreadcrumb(breadcrumb) {
        if (!breadcrumb.timestamp) {
            breadcrumb.timestamp = this.timestamp();
        }
        this.breadcrumbs.push(breadcrumb);
    }
    /**
     * Captures an exception event and sends it to Sentry.
     *
     * @param exception An exception-like object.
     * @returns The generated eventId, or undefined if event wasn't scheduled.
     */
    captureException(exception) {
        this.debug(() => this.log(`calling captureException`));
        const event = this.buildEvent({});
        if (!event)
            return;
        this.options.waitUntil(this.reportException(event, exception));
        return event.event_id;
    }
    /**
     * Captures a message event and sends it to Sentry.
     *
     * @param message The message to send to Sentry.
     * @param level Define the level of the message.
     * @returns The generated eventId, or undefined if event wasn't scheduled.
     */
    captureMessage(message, level = "info") {
        this.debug(() => this.log(`calling captureMessage`));
        const event = this.buildEvent({ level, message });
        if (!event)
            return;
        this.options.waitUntil(this.reportMessage(event));
        return event.event_id;
    }
    /**
     * Updates user context information for future events.
     *
     * @param user — User context object to be set in the current context. Pass null to unset the user.
     */
    setUser(user) {
        this.user = user ? user : undefined;
    }
    /**
     * In Cloudflare Workers it’s not possible to read event.request's body after having generated a response (if you attempt to, it throws an exception).
     * Chances are that if you are interested in reporting request body to Sentry, you have already read the data (via request.json()/request.text()).
     * Use this method to set it in Sentry context.
  
     * @param body
     */
    setRequestBody(body) {
        this.request.data = body;
    }
    /**
     * Send data to Sentry.
     *
     * @param data Event data
     */
    async postEvent(data) {
        var _a, _b;
        // We are sending User-Agent for backwards compatibility with older Sentry
        let headers = {
            "Content-Type": "application/json",
            "User-Agent": "toucan-js/2.2.1",
        };
        // Build headers
        if ((_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.transportOptions) === null || _b === void 0 ? void 0 : _b.headers) {
            headers = {
                ...headers,
                ...this.options.transportOptions.headers,
            };
        }
        // Build body string
        const body = JSON.stringify(data);
        // Log the outgoing request
        this.debug(() => {
            this.log(`sending request to Sentry with headers: ${JSON.stringify(headers)} and body: ${body}`);
        });
        // Send to Sentry and wait for Response
        const response = await fetch(this.url, {
            method: "POST",
            body,
            headers,
        });
        // Log the response
        await this.debug(() => {
            return this.logResponse(response);
        });
        // Resolve with response
        return response;
    }
    /**
     * Builds event payload. Applies beforeSend.
     *
     * @param additionalData Additional data added to defaults.
     * @returns Event
     */
    buildEvent(additionalData) {
        var _a;
        const sampleRate = this.options.sampleRate;
        // 1.0 === 100% events are sent
        // 0.0 === 0% events are sent
        if (typeof sampleRate === "number" && Math.random() > sampleRate) {
            this.debug(() => this.log(`skipping this event (sampleRate === ${sampleRate})`));
            return;
        }
        const pkg = this.options.pkg;
        // 'release' option takes precedence, if not present - try to derive from package.json
        const release = this.options.release
            ? this.options.release
            : pkg
                ? `${pkg.name}-${pkg.version}`
                : undefined;
        // per https://docs.sentry.io/development/sdk-dev/event-payloads/#required-attributes
        const payload = {
            event_id: uuid.v4().replace(/-/g, ""),
            logger: "EdgeWorker",
            platform: "node",
            release,
            environment: this.options.environment,
            user: this.user,
            timestamp: this.timestamp(),
            level: "error",
            modules: pkg
                ? {
                    ...pkg.dependencies,
                    ...pkg.devDependencies,
                }
                : undefined,
            breadcrumbs: this.getBreadcrumbs(),
            tags: this.tags,
            extra: this.extra,
            fingerprint: this.fingerprint,
            ...additionalData,
            request: { ...this.request },
            sdk: {
                name: "toucan-js",
                version: "2.2.1",
            },
        };
        const beforeSend = (_a = this.options.beforeSend) !== null && _a !== void 0 ? _a : this.beforeSend;
        return beforeSend(payload);
    }
    /**
     * Converts data from fetch event's Request to Sentry Request used in Sentry Event
     *
     * @param request FetchEvent Request
     * @returns Sentry Request
     */
    toSentryRequest(request) {
        // Build cookies
        const cookieString = request.headers.get("cookie");
        let cookies = undefined;
        if (cookieString) {
            try {
                cookies = cookie.parse(cookieString);
            }
            catch (e) { }
        }
        const headers = {};
        // Build headers (omit cookie header, because we built in in the previous step)
        for (const [k, v] of request.headers.entries()) {
            if (k !== "cookie") {
                headers[k] = v;
            }
        }
        const url = new URL(request.url);
        return {
            method: request.method,
            url: `${url.protocol}//${url.hostname}${url.pathname}`,
            query_string: url.search,
            cookies,
            headers,
        };
    }
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
    beforeSend(event) {
        const request = event.request;
        if (request) {
            // Let's try to remove sensitive data from incoming Request
            const allowedHeaders = this.options.allowedHeaders;
            const allowedCookies = this.options.allowedCookies;
            const allowedSearchParams = this.options.allowedSearchParams;
            if (allowedHeaders) {
                request.headers = this.applyAllowlist(request.headers, allowedHeaders);
            }
            else {
                delete request.headers;
            }
            if (allowedCookies) {
                request.cookies = this.applyAllowlist(request.cookies, allowedCookies);
            }
            else {
                delete request.cookies;
            }
            if (allowedSearchParams) {
                const params = Object.fromEntries(new URLSearchParams(request.query_string));
                const allowedParams = new URLSearchParams();
                Object.keys(this.applyAllowlist(params, allowedSearchParams)).forEach((allowedKey) => {
                    allowedParams.set(allowedKey, params[allowedKey]);
                });
                request.query_string = allowedParams.toString();
            }
            else {
                delete request.query_string;
            }
        }
        event.request = request;
        return event;
    }
    /**
     * Helper function that applies 'allowlist' on 'obj' keys.
     *
     * @param obj
     * @param allowlist
     * @returns New object with allowed keys.
     */
    applyAllowlist(obj = {}, allowlist) {
        let predicate = (item) => false;
        if (allowlist instanceof RegExp) {
            predicate = (item) => allowlist.test(item);
        }
        else if (Array.isArray(allowlist)) {
            const allowlistLowercased = allowlist.map((item) => item.toLowerCase());
            predicate = (item) => allowlistLowercased.includes(item);
        }
        else {
            this.debug(() => this.warn("allowlist must be an array of strings, or a regular expression."));
            return {};
        }
        return Object.keys(obj)
            .map((key) => key.toLowerCase())
            .filter((key) => predicate(key))
            .reduce((allowed, key) => {
            allowed[key] = obj[key];
            return allowed;
        }, {});
    }
    /**
     * A number representing the seconds elapsed since the UNIX epoch.
     */
    timestamp() {
        return Date.now() / 1000;
    }
    /**
     * Builds Message as per https://develop.sentry.dev/sdk/event-payloads/message/, adds it to the event,
     * and sends it to Sentry. Inspired by https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/backend.ts.
     *
     * @param event
     */
    async reportMessage(event) {
        return this.postEvent(event);
    }
    /**
     * Builds Exception as per https://docs.sentry.io/development/sdk-dev/event-payloads/exception/, adds it to the event,
     * and sends it to Sentry. Inspired by https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/backend.ts.
     *
     * @param event
     * @param error
     */
    async reportException(event, maybeError) {
        let error;
        if (utils.isError(maybeError)) {
            error = maybeError;
        }
        else if (utils.isPlainObject(maybeError)) {
            // This will allow us to group events based on top-level keys
            // which is much better than creating new group when any key/value change
            const message = `Non-Error exception captured with keys: ${utils.extractExceptionKeysForMessage(maybeError)}`;
            this.setExtra("__serialized__", utils.normalizeToSize(maybeError));
            error = new Error(message);
        }
        else {
            // This handles when someone does: `throw "something awesome";`
            // We use synthesized Error here so we can extract a (rough) stack trace.
            error = new Error(maybeError);
        }
        const stacktrace = await this.buildStackTrace(error);
        event.exception = {
            values: [{ type: error.name, value: error.message, stacktrace }],
        };
        return this.postEvent(event);
    }
    /**
     * Builds Stacktrace as per https://docs.sentry.io/development/sdk-dev/event-payloads/stacktrace/
     *
     * @param error Error object.
     * @returns Stacktrace
     */
    async buildStackTrace(error) {
        var _a;
        if (this.options.attachStacktrace === false) {
            return undefined;
        }
        try {
            const stack = await stacktraceJs.fromError(error);
            /**
             * sentry-cli and webpack-sentry-plugin upload the source-maps named by their path with a ~/ prefix.
             * Lets adhere to this behavior.
             */
            const rewriteFrames = (_a = this.options.rewriteFrames) !== null && _a !== void 0 ? _a : {
                root: "~/",
                iteratee: (frame) => frame,
            };
            return {
                frames: stack
                    .map((frame) => {
                    var _a;
                    const filename = (_a = frame.fileName) !== null && _a !== void 0 ? _a : "";
                    const stackFrame = {
                        colno: frame.columnNumber,
                        lineno: frame.lineNumber,
                        filename,
                        function: frame.functionName,
                    };
                    if (!!rewriteFrames.root) {
                        stackFrame.filename = `${rewriteFrames.root}${stackFrame.filename}`;
                    }
                    return !!rewriteFrames.iteratee
                        ? rewriteFrames.iteratee(stackFrame)
                        : stackFrame;
                })
                    .reverse(),
            };
        }
        catch (e) {
            return undefined;
        }
    }
    /**
     * Get the breadcrumbs. If the stack size exceeds MAX_BREADCRUMBS, returns the last MAX_BREADCRUMBS breadcrumbs.
     */
    getBreadcrumbs() {
        var _a;
        const maxBreadcrumbs = (_a = this.options.maxBreadcrumbs) !== null && _a !== void 0 ? _a : 100;
        if (this.breadcrumbs.length > maxBreadcrumbs) {
            return this.breadcrumbs.slice(this.breadcrumbs.length - maxBreadcrumbs);
        }
        else {
            return this.breadcrumbs;
        }
    }
    /**
     * Runs a callback if debug === true.
     * Use this to delay execution of debug logic, to ensure toucan doesn't burn I/O in non-debug mode.
     *
     * @param callback
     */
    debug(callback) {
        if (this.options.debug) {
            return callback();
        }
    }
    log(message) {
        console.log(`toucan-js: ${message}`);
    }
    warn(message) {
        console.warn(`toucan-js: ${message}`);
    }
    error(message) {
        console.error(`toucan-js: ${message}`);
    }
    /**
     * Reads and logs Response object from Sentry. Uses a clone, not the original, so the body can be used elsewhere.
     * Do not use without this.debug wrapper.
     *
     * @param originalResponse Response
     */
    async logResponse(originalResponse) {
        var _a;
        // Make a copy of original response so the body can still be read elsewhere
        const response = originalResponse.clone();
        let responseText = "";
        // Read response body, set to empty if fails
        try {
            responseText = await response.text();
        }
        catch (e) {
            responseText += "";
        }
        // Parse origin from response.url, but at least give some string if parsing fails.
        let origin = "Sentry";
        try {
            const originUrl = new URL(response.url);
            origin = originUrl.origin;
        }
        catch (e) {
            origin = (_a = response.url) !== null && _a !== void 0 ? _a : "Sentry";
        }
        const msg = `${origin} responded with [${response.status} ${response.statusText}]: ${responseText}`;
        if (response.ok) {
            this.log(msg);
        }
        else {
            this.error(msg);
        }
    }
}

exports.Toucan = Toucan;
