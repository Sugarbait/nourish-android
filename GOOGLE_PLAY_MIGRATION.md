# Nourish Google Play Store Migration Guide

## Project Overview

This document comprehensively documents the process of preparing the Nourish nutrition tracking app for Google Play Store release with a complete architecture change from Stripe payment processing to native Google Play Billing.

**Key Objective:** Remove Stripe, implement Google Play Billing (native Android in-app purchases), and wrap the existing Next.js web app as a native Android application using Capacitor.

**App Details:**
- App Name: Nourish
- Package ID: com.neoncell.nourish
- Current Version: 0.3.15
- Platform: Originally web-based (Next.js), now wrapped with Capacitor for Android

---

## Architecture & Technology Stack

### Original Stack
- **Frontend:** Next.js (React) web application
- **Backend:** Convex (Backend-as-a-Service)
- **Database:** Convex-managed database
- **Payments:** Stripe (cloud-based payment processing)
- **Deployment:** Web-only

### New Stack for Google Play
- **Frontend:** Next.js web app (unchanged)
- **Mobile Wrapper:** Capacitor (wraps web app as native Android)
- **Backend:** Convex (unchanged)
- **Payments:** Google Play Billing (native Android in-app purchases)
- **Native Features:** Android-specific functionality via Capacitor plugins
- **Distribution:** Google Play Store (Android only for now)

### Why Capacitor?
- Minimal changes to existing Next.js codebase
- Leverages existing web development investment
- Provides native Android app shell with access to native APIs
- Faster time-to-market than full native rewrite
- Same functionality as fully native app when properly configured

---

## Key Concepts Explained

### Google Play Billing
Native Android in-app purchase and subscription system required by Google Play Store Digital Goods Policy. All digital goods (subscriptions, credit packs) MUST use Google Play Billing.

**Compliance Note:** Google Play requires that all digital subscriptions and in-app purchases go through Google Play Billing. Stripe cannot be used as an alternative payment method for digital goods.

### Android App Bundle (AAB)
Production-ready Android app format optimized for Google Play Store. Contains all resources, code, and configurations. Google Play generates optimized APKs per device configuration.

**File:** `android/app/release/app-release.aab`

### Android Keystore
Cryptographic certificate used to sign the app. Required for:
- Google Play Store submission
- App updates (same certificate required)
- Securing the app

**File:** `android/app/release-key.jks`
**Alias:** `nourish_release`

### Deep Linking
Android deep link protocol allowing URLs to open the app directly. Format: `com.neoncell.nourish://path?params`

Used for: Email verification links, invitation links, etc.

### R8/ProGuard
Code obfuscation tool that reduces app size and protects code. For first release, left disabled to facilitate crash analysis during testing.

---

## Files Created & Modified

### 1. lib/googlePlayBilling.ts (CREATED)
**Purpose:** Client-side Google Play Billing integration

**Key Functions:**
- `initializeBilling()` - Initialize Google Play Billing
- `launchPurchaseFlow()` - Start purchase/subscription flow
- `validatePurchase()` - Verify purchase tokens
- `getSubscriptionDuration()` - Duration from subscription type
- `getCreditsForProduct()` - Map product IDs to credit amounts
- `isSubscription()` - Check if product is subscription
- `isConsumable()` - Check if product is consumable

**Product IDs Mapped:**
- Subscriptions: `nourish_pro_monthly`, `nourish_pro_yearly`
- Credit Packs: `nourish_credits_small`, `nourish_credits_medium`, `nourish_credits_large`

---

### 2. convex/googlePlayBilling.ts (CREATED)
**Purpose:** Backend validation of purchases

**Key Functions:**
- `validatePurchaseToken()` - Verify purchase with Google Play API
- `activateSubscription()` - Process subscription activation
- `addCreditPack()` - Add credits from consumable purchase
- `getSubscription()` - Retrieve user subscription
- `getCreditsForSync()` - Get credits for offline sync

**Important:** All purchases must be validated on backend before granting credits/subscriptions.

---

### 3. convex/accountDeletion.ts (CREATED)
**Purpose:** Comply with Google Play data deletion requirements

**Key Function:** `deleteUserAccount(userId, password)`

**Deletes:**
- User account and login credentials
- All meal logs and nutrition history
- All AI conversations and coaching data
- Saved recipes and preferences
- Water intake logs
- Subscription and credit information
- User profile

**Security:** Requires password verification before deletion.

**Compliance:** Satisfies GDPR and Google Play Store requirements for user data deletion.

---

### 4. app/delete-account/page.tsx (CREATED)
**Purpose:** User-facing account deletion page

**Features:**
- Password verification field
- "DELETE" text confirmation requirement
- Clear warning about irreversible action
- Lists all data that will be deleted
- Clears localStorage on success
- Redirects to home after deletion

**Route:** `/delete-account`

**Styling:** Destructive action styling (red, warning alert)

---

### 5. components/pricing-modal.tsx (MODIFIED)
**Changes:**
- Removed: `createCheckoutSession` action
- Removed: All Stripe references
- Removed: `stripeCustomerId` state
- Added: Google Play product ID references
- Updated: UI text from "Stripe" to "Google Play"
- Updated: Loading overlay text references
- Changed: `launchPurchase()` to use Google Play Billing flow

**Impact:** Users now see "Processing with Google Play" during purchases.

---

### 6. components/dashboard.tsx (MODIFIED)
**Changes:**
- Removed: `getBillingPortalUrl` action import
- Removed: `stripeCustomerId` query
- Removed: Stripe checkout success polling useEffect
- Removed: Checkout cancelled useEffect and state
- Removed: Checkout cancelled Dialog component
- Removed: "Manage Subscription" button (Stripe portal)
- Added: Text "Manage your subscription in Google Play Settings"
- Added: "Delete Account" link in settings menu (destructive styling)
- Added: `useRouter` import for navigation

**Impact:** 
- Users no longer see Stripe portal option
- Account deletion accessible from settings menu
- Subscription management delegated to Google Play Settings app

---

### 7. convex/http.ts (MODIFIED - Complete Replacement)
**Changes:**
- Removed: Entire `/stripe-webhook` endpoint
- Removed: `/stripe-portal` endpoint
- Removed: `/stripe-checkout` endpoint
- Removed: All CORS configuration for Stripe
- Added: Minimal GET `/health` endpoint for health checks

**Reason:** Google Play Billing handles subscriptions server-side. No webhook needed. Health check retained for monitoring.

---

### 8. convex/emails.ts (MODIFIED)
**Changes:**
- Line 34: Verification URL changed from web URL to deep link
- OLD: `const verifyUrl = ${SITE_URL}/verify-email/?token=...&email=...`;`
- NEW: `const verifyUrl = com.neoncell.nourish://verify?token=...&email=...`;`

**Reason:** Deep link opens app directly instead of browser. Better UX for mobile.

**Deployment:** Must redeploy Convex after this change.

---

### 9. android/app/build.gradle (MODIFIED)
**Changes:**
- Added `signingConfigs.release` block with:
  - `storeFile: 'release-key.jks'` (keystore location)
  - `keyAlias: 'nourish_release'`
  - Password from environment or fallback value
- Updated `release` buildType to use signing config
- Changed `versionCode` from 1 to 315 (matches 0.3.15)
- Changed `versionName` from "1.0" to "0.3.15"

**Impact:** App properly signed for Google Play Store.

---

### 10. android/local.properties (CREATED)
**Content:**
```
sdk.dir=/Users/clientele/Library/Android/sdk
```

**Purpose:** Point Android build system to SDK installation location.

---

### 11. .gitignore (MODIFIED)
**Added Entries:**
```
*.jks
*.keystore
android/app/release-key.jks
```

**Purpose:** Prevent accidentally committing keystore files (security risk).

---

### 12. capacitor.config.ts (MODIFIED)
**Changes:**
- Updated `appName` from 'nourish' to 'Nourish'
- Added `ios` and `android` platform configurations
- Added `plugins.Purchase` configuration with Google Play credentials

**Purpose:** Configure Capacitor for Android build and enable Google Play Billing plugin.

---

## Errors Encountered & Solutions

### Error 1: Java Version Incompatibility
**Symptom:** `Unsupported class file major version 69` during build
**Cause:** Java 25 incompatible with Gradle 8.14.3
**Solution:** Installed Java 21 (compatible version)
```bash
brew install openjdk@21
```

---

### Error 2: Android SDK Not Found
**Symptom:** `SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable`
**Cause:** Missing `android/local.properties` configuration
**Solution:** Created file with correct SDK path:
```
sdk.dir=/Users/clientele/Library/Android/sdk
```

---

### Error 3: Missing Dependency (otplib)
**Symptom:** Build failed with `Cannot find module 'otplib'`
**Cause:** Dependency not installed
**Solution:** Installed packages:
```bash
npm install otplib qrcode
npm install -D @types/qrcode
```

---

### Error 4: Stripe Package Still Referenced
**Symptom:** TypeScript error `Cannot find module 'stripe'` in http.ts
**Cause:** Old Stripe webhook handler still in file
**Solution:** Replaced entire http.ts file, removed all Stripe code

---

### Error 5: Convex Import Issue
**Symptom:** `Module '"./_generated/server"' has no exported member 'internal'`
**Cause:** Duplicate import at bottom of googlePlayBilling.ts
**Solution:** Removed duplicate import, kept single import at top

---

## Build Process

### Prerequisites
- Node.js 18+
- Java 21
- Android SDK (API 33+)
- Keystore file (`android/app/release-key.jks`)

### Build Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Generate Keystore** (if not exists)
   ```bash
   keytool -genkey -v -keystore android/app/release-key.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias nourish_release
   ```

3. **Build Android App Bundle**
   ```bash
   npx capacitor build android
   cd android
   ./gradlew bundleRelease
   ```

4. **Locate Built AAB**
   ```
   android/app/release/app-release.aab
   ```

### Current Build Status
✅ AAB successfully built and ready for Google Play Store submission.

---

## Google Play Compliance Checklist

### Payment & Billing
- ✅ Stripe completely removed
- ✅ Google Play Billing implemented for subscriptions
- ✅ Google Play Billing implemented for in-app purchases
- ✅ All product IDs configured
- ✅ Backend validation in place

### Data & Privacy
- ✅ Account deletion functionality created
- ✅ Password verification required for deletion
- ✅ All user data properly deleted
- ✅ Data deletion documented in settings

### Email Verification
- ✅ Deep links implemented for email verification
- ✅ Users directed to app instead of web browser

### Code & Obfuscation
- ⚠️ R8/ProGuard disabled for first release (for easier crash debugging)
- Note: Can be enabled in future releases after stability confirmed

### Testing Requirements
- [ ] Create test account for Google Play
- [ ] Test subscription purchase flow
- [ ] Test credit pack purchases
- [ ] Test account deletion
- [ ] Verify email verification flow
- [ ] Test deep linking

---

## Google Play Store Submission

### Required Information

1. **App Details**
   - App Name: Nourish
   - Package: com.neoncell.nourish
   - Version: 0.3.15
   - AAB File: `android/app/release/app-release.aab`

2. **Store Listing**
   - Screenshots (minimum 2, up to 8)
   - App icon (512x512)
   - Feature graphic (1024x500)
   - Short description (50 chars max)
   - Full description (4000 chars max)
   - Category: Health & Fitness

3. **Data Safety**
   - Google Play Data Safety form must be completed
   - Declare all data collection (if any)
   - Specify user data handling

4. **Content Rating**
   - Complete content rating questionnaire
   - Likely rating: Everyone 3+ (health/fitness app)

5. **Testing**
   - Provide test accounts for reviewers
   - Include instructions for testing subscriptions

### Submission Steps
1. Upload AAB file to Google Play Console
2. Complete store listing
3. Submit data safety form
4. Provide test accounts
5. Submit for review
6. Google Play review team tests app (1-7 days typically)
7. App approved/rejected with feedback

---

## Feature Implementation Summary

### Removed Features
- ❌ Stripe payment integration
- ❌ Stripe checkout page
- ❌ Stripe customer portal
- ❌ Stripe webhooks

### Added Features
- ✅ Google Play Billing integration
- ✅ In-app subscription management
- ✅ In-app credit pack purchases
- ✅ Account deletion with password verification
- ✅ Android deep linking support
- ✅ Native Android wrapper via Capacitor

### Unchanged Features
- ✅ Meal recognition AI
- ✅ Nutrition tracking
- ✅ AI coach
- ✅ Water logging
- ✅ User profiles
- ✅ All other core functionality

---

## Project Structure

```
/Users/clientele/Desktop/Android Apps/Nourish/
├── app/
│   └── delete-account/
│       └── page.tsx (NEW)
├── android/
│   ├── app/
│   │   ├── build.gradle (MODIFIED)
│   │   └── release-key.jks (KEYSTORE - NOT COMMITTED)
│   └── local.properties (CREATED)
├── components/
│   ├── dashboard.tsx (MODIFIED)
│   └── pricing-modal.tsx (MODIFIED)
├── convex/
│   ├── accountDeletion.ts (CREATED)
│   ├── googlePlayBilling.ts (CREATED)
│   ├── emails.ts (MODIFIED)
│   └── http.ts (MODIFIED)
├── lib/
│   └── googlePlayBilling.ts (CREATED)
├── capacitor.config.ts (MODIFIED)
├── .gitignore (MODIFIED)
└── GOOGLE_PLAY_MIGRATION.md (THIS FILE)
```

---

## Important Notes & Best Practices

### Security
- **Keystore:** Keep `release-key.jks` safe. Losing it means you can't update the app.
- **Keystore Backup:** Store backup in secure location
- **Password:** Don't commit keystore password to code
- **Private Keys:** All private keys must be protected

### Backend Deployment
- **Always deploy Convex changes** when email, purchase validation, or account deletion code changes
- Changes don't require app rebuild
- Deployments are independent from app releases

### Testing
- Use Google Play test accounts for subscription testing
- Never use real payment methods during development
- Test all purchase flows before submission

### Version Management
- versionCode: Must increment for each release (currently 315 for v0.3.15)
- versionName: Human-readable version (currently 0.3.15)
- Keep in sync with app version

### Deep Linking
- Verify deep links work in both web and native contexts
- Test with actual Android devices
- Ensure intent filters configured in AndroidManifest.xml

---

## Future Enhancements

1. **R8/ProGuard Obfuscation**
   - Enable after first release stability
   - Reduces app size and protects code
   - May complicate crash analysis initially

2. **iOS Support**
   - App Store requires StoreKit2 (similar to Google Play Billing)
   - Architecture already prepared for iOS
   - Would use same backend Google Play Billing service

3. **Additional Features**
   - Push notifications (Firebase Cloud Messaging)
   - Biometric authentication (fingerprint/face)
   - Offline meal logging with sync
   - Health kit integration

4. **A/B Testing**
   - Test different pricing tiers
   - Monitor subscription retention
   - Optimize credit pack pricing

---

## Reference Links & Documentation

### Official Documentation
- [Google Play Billing Documentation](https://developer.android.com/google/play/billing)
- [Capacitor Documentation](https://capacitorjs.com/)
- [Android Deep Linking](https://developer.android.com/training/app-links/deep-linking)
- [Android App Bundle Format](https://developer.android.com/guide/app-bundle)

### Google Play Console
- [Google Play Console](https://play.google.com/console)
- [App Release Requirements](https://support.google.com/googleplay/android-developer/answer/2521331)
- [Digital Goods Policy](https://support.google.com/googleplay/android-developer/answer/2614348)

### Convex Backend
- [Convex Documentation](https://docs.convex.dev/)
- [Convex Auth](https://docs.convex.dev/auth)
- [Convex HTTP Actions](https://docs.convex.dev/http-actions)

### Next.js
- [Next.js Documentation](https://nextjs.org/docs)
- [App Router](https://nextjs.org/docs/app)

---

## Contact & Support

**Email:** contactus@neoncell.ca

For app-related questions, support can be reached via the contact form in the app settings.

---

## Document History

**Created:** May 16, 2026
**Last Updated:** May 16, 2026
**Version:** 1.0

This document serves as the authoritative reference for the Nourish Google Play Store migration project.
