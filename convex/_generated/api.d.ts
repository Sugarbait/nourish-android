/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDeletion from "../accountDeletion.js";
import type * as accountDeletionInternal from "../accountDeletionInternal.js";
import type * as admin from "../admin.js";
import type * as adminAuth from "../adminAuth.js";
import type * as adminBroadcast from "../adminBroadcast.js";
import type * as adminStats from "../adminStats.js";
import type * as adminTotp from "../adminTotp.js";
import type * as adminTotpDb from "../adminTotpDb.js";
import type * as aiMessages from "../aiMessages.js";
import type * as auth from "../auth.js";
import type * as authInternal from "../authInternal.js";
import type * as contact from "../contact.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as gemini from "../gemini.js";
import type * as googlePlayBilling from "../googlePlayBilling.js";
import type * as http from "../http.js";
import type * as meals from "../meals.js";
import type * as notifications from "../notifications.js";
import type * as recipes from "../recipes.js";
import type * as retention from "../retention.js";
import type * as stripe from "../stripe.js";
import type * as stripeActions from "../stripeActions.js";
import type * as users from "../users.js";
import type * as verifyEmail from "../verifyEmail.js";
import type * as waterLogs from "../waterLogs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDeletion: typeof accountDeletion;
  accountDeletionInternal: typeof accountDeletionInternal;
  admin: typeof admin;
  adminAuth: typeof adminAuth;
  adminBroadcast: typeof adminBroadcast;
  adminStats: typeof adminStats;
  adminTotp: typeof adminTotp;
  adminTotpDb: typeof adminTotpDb;
  aiMessages: typeof aiMessages;
  auth: typeof auth;
  authInternal: typeof authInternal;
  contact: typeof contact;
  conversations: typeof conversations;
  crons: typeof crons;
  emails: typeof emails;
  gemini: typeof gemini;
  googlePlayBilling: typeof googlePlayBilling;
  http: typeof http;
  meals: typeof meals;
  notifications: typeof notifications;
  recipes: typeof recipes;
  retention: typeof retention;
  stripe: typeof stripe;
  stripeActions: typeof stripeActions;
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
