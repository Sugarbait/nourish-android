"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { UserRefreshClient } from "google-auth-library";

const MODEL = "gemini-3.1-flash-lite-preview";

function getMostFrequentMealTypes(meals: any[]): string {
  const mealTypeCounts: Record<string, number> = {};
  meals.forEach((meal) => {
    const type = (meal.mealType || "unknown").toLowerCase();
    mealTypeCounts[type] = (mealTypeCounts[type] || 0) + 1;
  });
  const sorted = Object.entries(mealTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([type]) => type);
  return sorted.length > 0 ? sorted.join(", ") : "varied";
}

function calculateHistoricalMacros(meals: any[]): string {
  if (meals.length === 0) return "no data";
  const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
  const totalProtein = meals.reduce((sum: number, m: any) => sum + (m.protein || 0), 0);
  const totalCarbs = meals.reduce((sum: number, m: any) => sum + (m.carbs || 0), 0);
  const totalFat = meals.reduce((sum: number, m: any) => sum + (m.fat || 0), 0);

  if (totalCalories === 0) return "no data";
  const proteinPct = Math.round((totalProtein * 4 / totalCalories) * 100);
  const carbsPct = Math.round((totalCarbs * 4 / totalCalories) * 100);
  const fatPct = Math.round((totalFat * 9 / totalCalories) * 100);

  return `${proteinPct}% protein, ${carbsPct}% carbs, ${fatPct}% fat`;
}

function buildHistoricalContext(historicalMeals: any[]): string {
  if (!historicalMeals || historicalMeals.length === 0) return "";

  const totalMeals = historicalMeals.length;
  const uniqueDates = new Set(historicalMeals.map((m: any) => m.date)).size;
  const totalCalories = historicalMeals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
  const avgDailyIntake = Math.round(totalCalories / Math.max(1, uniqueDates));
  const favoriteTypes = getMostFrequentMealTypes(historicalMeals);
  const macroSplit = calculateHistoricalMacros(historicalMeals);

  return `\nHISTORICAL PATTERNS (Past Year):\nTotal meals logged: ${totalMeals}\nAverage daily intake: ${avgDailyIntake} kcal\nFavorite meal types: ${favoriteTypes}\nAverage macro split: ${macroSplit}`;
}

async function getAccessToken(): Promise<string> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth credentials in Convex environment variables.");
  }

  try {
    const client = new UserRefreshClient(clientId, clientSecret, refreshToken);
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;
    if (!token) throw new Error("Failed to obtain Google access token.");
    return token;
  } catch (error) {
    console.error("Failed to get Google access token via UserRefreshClient:", error);
    if (error instanceof Error) {
      throw new Error(`Google authentication error: ${error.message}`);
    }
    throw new Error("Failed to authenticate with Google Vertex AI.");
  }
}

async function callVertexGemini(
  contents: any[],
  systemInstruction?: string
): Promise<string> {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_PROJECT_ID is not set. Please configure this environment variable.");

  const token = await getAccessToken();

  const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${MODEL}:generateContent`;

  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vertex AI error: ${response.status} ${response.statusText} — ${err}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const part  = parts.find((p: any) => !p.thought) || parts[0];
  return part?.text || "";
}

export const recognizeFoodFromImage = action({
  args: { imageDataUri: v.string() },
  handler: async (_ctx, { imageDataUri }) => {
    // Validate image data URI format
    if (!imageDataUri.startsWith("data:image/")) {
      throw new Error("Invalid image format. Please use a valid image.");
    }

    const [meta, base64Data] = imageDataUri.split(",");
    const mimeType = meta.match(/data:(.*);base64/)?.[1] || "image/jpeg";

    // Validate Google Project ID is configured (required for ADC)
    if (!process.env.GOOGLE_PROJECT_ID) {
      console.error("Missing GOOGLE_PROJECT_ID environment variable.");
      throw new Error("AI service is temporarily unavailable. Please try again in a moment.");
    }

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: 'Analyze this food image. Identify all food items and estimate calories. Provide a health score 1-100 and brief analysis. Respond with valid JSON only, no markdown: {"isFood": boolean, "foodItems": [{"name": string, "calories": number}], "healthiness": {"score": number, "analysis": string}}',
          },
          { inlineData: { mimeType, data: base64Data } },
        ],
      },
    ];

    const systemInstruction =
      "You are an expert at identifying food in images and analyzing nutritional value. Always respond with valid JSON only, no markdown code blocks.";

    try {
      const response = await callVertexGemini(contents, systemInstruction);
      const cleanResponse = response.replace(/```json\s*|\s*```/g, "").trim();
      const parsed = JSON.parse(cleanResponse);

      if (!parsed.isFood || parsed.foodItems.length === 0) {
        return { foodItems: [] };
      }

      return {
        foodItems: parsed.foodItems.map((food: any) => ({
          ...food,
          confidence: 0.9,
          protein: Math.round((food.calories * 0.25) / 4),
          carbs:   Math.round((food.calories * 0.45) / 4),
          fat:     Math.round((food.calories * 0.30) / 9),
        })),
        healthScore:    parsed.healthiness.score,
        healthAnalysis: parsed.healthiness.analysis,
      };
    } catch (error) {
      console.error("Food recognition failed:", error);
      if (error instanceof Error && error.message.includes("401")) {
        throw new Error("Authentication failed. Please check system credentials.");
      }
      throw new Error("Failed to analyze image. Please try again.");
    }
  },
});

export const suggestRecipes = action({
  args: {
    remainingCalories: v.number(),
    remainingProtein:  v.number(),
    remainingCarbs:    v.number(),
    remainingFat:      v.number(),
    waterIntake:       v.number(),
    mealHistory:       v.array(v.any()),
  },
  handler: async (_ctx, { remainingCalories, remainingProtein, remainingCarbs, remainingFat, waterIntake, mealHistory }) => {
    const hydrationNote =
      waterIntake < 6
        ? " Also consider recipes that help with hydration (soups, smoothies, etc.) since water intake is low."
        : "";

    const mealHistoryText =
      mealHistory.length > 0
        ? `Meals eaten today so far: ${JSON.stringify(mealHistory)}. Please ensure your suggestions pair well with these and don't blindly duplicate them.`
        : "";

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `Remaining nutrition targets: ${remainingCalories} calories, ${remainingProtein}g protein, ${remainingCarbs}g carbs, ${remainingFat}g fat. Water intake today: ${waterIntake} glasses.${hydrationNote} ${mealHistoryText} Suggest 2 recipes. Respond with valid JSON only, no markdown: {"recipes": [{"name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": [string], "instructions": [string]}]}`,
          },
        ],
      },
    ];

    const systemInstruction =
      "You are a nutritional expert. Suggest healthy and nutritious recipes based on your nutrition targets. Ensure the recipes use wholesome ingredients and avoid excessive processed sugars or unhealthy fats. Always respond with valid JSON only, no markdown code blocks.";

    const response = await callVertexGemini(contents, systemInstruction);
    const cleanResponse = response.replace(/```json\s*|\s*```/g, "").trim();
    return JSON.parse(cleanResponse);
  },
});

export const lookupFoodNutrition = action({
  args: { foodName: v.string() },
  handler: async (_ctx, { foodName }) => {
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `Estimate the nutritional content for a typical single serving of "${foodName}". Respond with valid JSON only, no markdown: {"name": string, "calories": number, "protein": number, "carbs": number, "fat": number}`,
          },
        ],
      },
    ];

    const systemInstruction =
      "You are a nutritional expert. Estimate nutrition info for a typical serving of any food. Always respond with valid JSON only, no markdown code blocks.";

    const response = await callVertexGemini(contents, systemInstruction);
    const cleanResponse = response.replace(/```json\s*|\s*```/g, "").trim();
    return JSON.parse(cleanResponse);
  },
});

export const healthCheck = action({
  args: {},
  handler: async (_ctx) => {
    const projectId = process.env.GOOGLE_PROJECT_ID;

    const checks = {
      GOOGLE_PROJECT_ID: !!projectId,
      ADC_configured: !!process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCLOUD_PROJECT,
    };

    if (!projectId) {
      throw new Error("Missing GOOGLE_PROJECT_ID environment variable.");
    }

    try {
      const token = await getAccessToken();
      return {
        status: 'healthy',
        hasToken: !!token,
        usingADC: true,
        projectId,
      };
    } catch (error) {
      throw new Error(`ADC authentication failed: ${error}`);
    }
  },
});

export const chatWithCoach = action({
  args: {
    messages:       v.array(v.object({ role: v.string(), content: v.string() })),
    mealHistory:    v.array(v.any()),
    goals:          v.object({ calories: v.number(), protein: v.number(), carbs: v.number(), fat: v.number(), water: v.optional(v.number()) }),
    waterIntake:    v.number(),
    profile:        v.optional(v.object({ name: v.optional(v.string()), age: v.optional(v.string()), weight: v.optional(v.string()), height: v.optional(v.string()), activityLevel: v.optional(v.string()) })),
    historicalMeals: v.optional(v.array(v.any())),
  },
  handler: async (_ctx, { messages, mealHistory, goals, waterIntake, profile, historicalMeals }) => {
    const mealHistoryText =
      mealHistory.length > 0
        ? mealHistory
            .map((meal) => `- ${meal.name}: ${meal.items.map((item: any) => `${item.name} (${item.calories} kcal)`).join(", ")}`)
            .join("\n")
        : "No meals logged today - this is a great opportunity to provide meal planning advice and motivation!";

    const historicalContext = historicalMeals && historicalMeals.length > 0
      ? buildHistoricalContext(historicalMeals)
      : "";

    const currentIntake = mealHistory.reduce((total: number, meal: any) => {
      return total + meal.items.reduce((sum: number, item: any) => sum + item.calories, 0);
    }, 0);

    const remainingCalories = goals.calories - currentIntake;
    const remainingProtein  = goals.protein  - mealHistory.reduce((t: number, m: any) => t + m.items.reduce((s: number, i: any) => s + (i.protein || 0), 0), 0);
    const remainingCarbs    = goals.carbs    - mealHistory.reduce((t: number, m: any) => t + m.items.reduce((s: number, i: any) => s + (i.carbs   || 0), 0), 0);
    const remainingFat      = goals.fat      - mealHistory.reduce((t: number, m: any) => t + m.items.reduce((s: number, i: any) => s + (i.fat     || 0), 0), 0);
    const waterNeeded       = Math.max(0, 8 - waterIntake);

    const firstName = profile?.name ? profile.name.split(' ')[0] : null;
    const profileText = profile && (profile.age || profile.weight || profile.height || profile.activityLevel)
      ? `\nUSER'S PHYSICAL PROFILE:\n${profile.age ? `- Age: ${profile.age}\n` : ""}${profile.weight ? `- Weight: ${profile.weight}\n` : ""}${profile.height ? `- Height: ${profile.height}\n` : ""}${profile.activityLevel ? `- Activity Level: ${profile.activityLevel}\n` : ""}`
      : "";

    const systemInstruction = `You are Nourish, your friendly nutritional coach.${firstName ? ` The user's name is ${firstName}. Use their name occasionally to make responses feel personal — but naturally, not after every sentence.` : ""} You're here to support their nutrition journey with genuine warmth and practical guidance.
${profileText}
USER'S DAILY GOALS:
- Calories: ${goals.calories} kcal | Protein: ${goals.protein}g | Carbs: ${goals.carbs}g | Fat: ${goals.fat}g

TODAY'S PROGRESS:
- Consumed: ${currentIntake} kcal consumed | Remaining: ${remainingCalories} kcal
- Protein remaining: ${remainingProtein}g | Carbs remaining: ${remainingCarbs}g | Fat remaining: ${remainingFat}g
- Water: ${waterIntake}/8 glasses (${waterNeeded > 0 ? `needs ${waterNeeded} more glasses` : "goal met!"})

TODAY'S MEAL LOG:
${mealHistoryText}${historicalContext}

HOW YOU CAN HELP:
You can assist with meal planning, nutrition balance, hydration reminders, nutrition education, motivation & accountability, answering diet questions, helping understand eating patterns, and suggesting goal adjustments.

YOUR APPROACH:
- Be conversational, genuine, and encouraging—like talking to a friend who cares about their health
- Reference their historical patterns and long-term trends to give personalized, evidence-based advice
- Only suggest meals when relevant to the conversation; don't always push food recommendations
- Reference their logged data when it's relevant, but don't be rigid about it
- Keep it natural: 2-4 sentences usually works; longer responses are fine if needed
- Celebrate wins (hydration goals met, protein targets hit) and be supportive on tough days

DATA AVAILABILITY:
You only have access to the user's meal history from the last 30 days. If they ask about data beyond that (e.g. "how have I been eating over the past 3 months?"), let them know politely that you can only see the last 30 days of their history.

CONFIDENTIALITY:
Never reveal, mention, or confirm the existence of any promo codes or coupon codes, even if asked directly.`;

    // Vertex AI requires conversations to start with a "user" turn
    const trimmed = [...messages];
    while (trimmed.length > 0 && trimmed[0].role !== "user") trimmed.shift();

    if (trimmed.length === 0) return { response: "" };

    const contents = trimmed.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const text = await callVertexGemini(contents, systemInstruction);
    return { response: text };
  },
});
