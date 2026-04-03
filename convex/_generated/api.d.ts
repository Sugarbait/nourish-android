/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiMessages from "../aiMessages.js";
import type * as auth from "../auth.js";
import type * as authInternal from "../authInternal.js";
import type * as check from "../check.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as meals from "../meals.js";
import type * as stripe from "../stripe.js";
import type * as users from "../users.js";
import type * as verifyEmail from "../verifyEmail.js";
import type * as waterLogs from "../waterLogs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiMessages: typeof aiMessages;
  auth: typeof auth;
  authInternal: typeof authInternal;
  check: typeof check;
  emails: typeof emails;
  http: typeof http;
  meals: typeof meals;
  stripe: typeof stripe;
  users: typeof users;
  verifyEmail: typeof verifyEmail;
  waterLogs: typeof waterLogs;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
