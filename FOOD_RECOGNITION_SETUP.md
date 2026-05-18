# Food Recognition AI Setup Guide

## Overview
The Nourish app uses Google Vertex AI (Gemini) for food image recognition and analysis. This feature requires proper authentication configuration in your Convex backend environment.

## Why Food Recognition May Be Inconsistent Across Profiles

### Root Cause
The inconsistency was caused by:
1. **Hardcoded API Keys** - Legacy code in `/lib/openai-client.ts` contained hardcoded API keys (security risk)
2. **Inconsistent API Paths** - Different code paths could use direct API calls vs. backend
3. **Missing Environment Variables** - Convex backend requires Google OAuth credentials to be configured
4. **Expired Credentials** - Google refresh tokens can expire, breaking food recognition for all users

### Solution Implemented
- ✅ Removed insecure `/lib/openai-client.ts` with hardcoded keys
- ✅ Centralized all AI operations through Convex backend (`/convex/gemini.ts`)
- ✅ Switched to **Google Application Default Credentials (ADC)** for authentication
- ✅ Eliminated need for multiple secret credentials (only `GOOGLE_PROJECT_ID` required)
- ✅ Added diagnostic health checks to identify credential issues
- ✅ Improved error messages to guide users and admins

## Required Environment Variables

The app uses **Google Application Default Credentials (ADC)** for authentication, which is simpler and more secure than explicit credentials.

### Setup (ADC)
1. Create a Google Cloud project with Vertex AI API enabled
2. Configure ADC on your Convex server (Convex handles this automatically on Google Cloud infrastructure)
3. Set only this environment variable in Convex:

```bash
# Your Google Cloud Project ID (required for all AI features)
GOOGLE_PROJECT_ID=your-project-id
```

### For Local Development
If testing locally, set up ADC:

```bash
# Option 1: Use a service account key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Option 2: Use gcloud auth (if running gcloud init)
gcloud auth application-default login

# Then set your project
export GOOGLE_PROJECT_ID=your-project-id
```

## Testing Credentials

### Using the Health Check API
Add a client action to test credentials:

```typescript
// In a new action or existing test file
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

async function testFoodRecognitionCredentials() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  try {
    const result = await client.action(api.gemini.healthCheck, {});
    console.log("✅ Credentials are properly configured:", result);
  } catch (error) {
    console.error("❌ Credential issue:", error);
  }
}
```

### Monitoring Food Recognition Failures

Check server logs for:
- `"Missing Google OAuth credentials"` - Environment variables not set
- `"Failed to obtain Google access token"` - Credentials invalid or expired
- `"Failed to analyze image"` - API call failed

## Food Recognition Flow

```
User captures image
    ↓
Client: getFoodRecognition(photoDataUri)
    ↓
Convex Backend: api.gemini.recognizeFoodFromImage()
    ↓
getAccessToken() → Google OAuth refresh
    ↓
callVertexGemini() → Analyze image with Gemini 3.1 Flash Lite (preview)
    ↓
Return: { foodItems, healthScore, healthAnalysis }
```

## Troubleshooting

### Issue: "AI service is temporarily unavailable"
**Cause**: Missing or invalid Google credentials  
**Solution**: Verify all 4 environment variables are set in Convex

### Issue: "Authentication failed"
**Cause**: Refresh token expired or credentials invalid  
**Solution**: 
1. Regenerate Google OAuth refresh token
2. Update Convex environment variables
3. Redeploy

### Issue: "Failed to analyze image"
**Cause**: API quota exceeded or transient network error  
**Solution**: Retry after a moment; contact Google Cloud support if persistent

## Security Notes

- ✅ **Never** commit API keys to version control
- ✅ **Always** use Convex environment variables for sensitive credentials
- ✅ **Never** expose API keys in client-side code
- ✅ **All** AI requests go through secure Convex backend
- ⚠️ Removed `/lib/openai-client.ts` which contained hardcoded keys

## Verification Checklist

Before deploying:
- [ ] `GOOGLE_PROJECT_ID` is set in Convex environment variables
- [ ] Vertex AI API is enabled in your Google Cloud project
- [ ] ADC is properly configured on Convex (automatic if running on Google Cloud)
- [ ] Run the health check to validate credentials work
- [ ] Test food recognition on multiple user profiles
- [ ] Check server logs for any credential errors
- [ ] Verify error messages are helpful to users

## Supported Models

Current: `gemini-3.1-flash-lite-preview`
- Fast response time
- Optimized for food recognition
- Supports image and text analysis

**Note:** The GA name `gemini-3.1-flash-lite` (without `-preview`) was tried in
commit v0.2.82 and broke food recognition — Vertex AI returned an error for
that model id. Stay on the preview name until Google confirms the GA name on
Vertex (it's not always the preview name minus the suffix).

## Response Format

Food recognition returns:

```typescript
{
  foodItems: [
    {
      name: string,           // e.g., "Chicken Breast"
      calories: number,       // Estimated calories
      confidence: number,     // 0-1 (always 0.9 from Gemini)
      protein: number,        // Calculated from calories
      carbs: number,          // Calculated from calories
      fat: number,            // Calculated from calories
    }
  ],
  healthScore?: number,       // 1-100 health rating
  healthAnalysis?: string,    // Brief health assessment
}
```

## Related Files

- `/convex/gemini.ts` - All AI backend actions (food recognition, recipes, nutrition, coaching)
- `/app/client-actions.ts` - Client-side action wrappers
- `/components/dashboard.tsx` - UI integration (camera capture, image upload)
- `Removed: /lib/openai-client.ts` - Legacy insecure code (deleted for security)
