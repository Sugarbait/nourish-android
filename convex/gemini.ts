"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { UserRefreshClient } from "google-auth-library";

const MODEL = "gemini-3.1-flash-lite-preview";

async function getAccessToken(): Promise<string> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth credentials in Convex environment variables.");
  }

  const client = new UserRefreshClient(clientId, clientSecret, refreshToken);
  client.scopes = ["https://www.googleapis.com/auth/cloud-platform"];
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain Google access token.");
  return token;
}

async function callVertexGemini(
  contents: any[],
  systemInstruction?: string
): Promise<string> {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_PROJECT_ID is not set.");

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
    const [meta, base64Data] = imageDataUri.split(",");
    const mimeType = meta.match(/data:(.*);base64/)?.[1] || "image/jpeg";

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

export const chatWithCoach = action({
  args: {
    messages:    v.array(v.object({ role: v.string(), content: v.string() })),
    mealHistory: v.array(v.any()),
    goals:       v.object({ calories: v.number(), protein: v.number(), carbs: v.number(), fat: v.number(), water: v.optional(v.number()) }),
    waterIntake: v.number(),
  },
  handler: async (_ctx, { messages, mealHistory, goals, waterIntake }) => {
    const mealHistoryText =
      mealHistory.length > 0
        ? mealHistory
            .map((meal) => `- ${meal.name}: ${meal.items.map((item: any) => `${item.name} (${item.calories} kcal)`).join(", ")}`)
            .join("\n")
        : "No meals logged today - this is a great opportunity to provide meal planning advice and motivation!";

    const currentIntake = mealHistory.reduce((total: number, meal: any) => {
      return total + meal.items.reduce((sum: number, item: any) => sum + item.calories, 0);
    }, 0);

    const remainingCalories = goals.calories - currentIntake;
    const remainingProtein  = goals.protein  - mealHistory.reduce((t: number, m: any) => t + m.items.reduce((s: number, i: any) => s + (i.protein || 0), 0), 0);
    const remainingCarbs    = goals.carbs    - mealHistory.reduce((t: number, m: any) => t + m.items.reduce((s: number, i: any) => s + (i.carbs   || 0), 0), 0);
    const remainingFat      = goals.fat      - mealHistory.reduce((t: number, m: any) => t + m.items.reduce((s: number, i: any) => s + (i.fat     || 0), 0), 0);
    const waterNeeded       = Math.max(0, 8 - waterIntake);

    const systemInstruction = `You are Nourish, your friendly nutritional coach. You're here to support their nutrition journey with genuine warmth and practical guidance.

USER'S DAILY GOALS:
- Calories: ${goals.calories} kcal | Protein: ${goals.protein}g | Carbs: ${goals.carbs}g | Fat: ${goals.fat}g

TODAY'S PROGRESS:
- Consumed: ${currentIntake} kcal consumed | Remaining: ${remainingCalories} kcal
- Protein remaining: ${remainingProtein}g | Carbs remaining: ${remainingCarbs}g | Fat remaining: ${remainingFat}g
- Water: ${waterIntake}/8 glasses (${waterNeeded > 0 ? `needs ${waterNeeded} more glasses` : "goal met!"})

TODAY'S MEAL LOG:
${mealHistoryText}

HOW YOU CAN HELP:
You can assist with meal planning, nutrition balance, hydration reminders, nutrition education, motivation & accountability, answering diet questions, helping understand eating patterns, and suggesting goal adjustments.

YOUR APPROACH:
- Be conversational, genuine, and encouraging—like talking to a friend who cares about their health
- Only suggest meals when relevant to the conversation; don't always push food recommendations
- Reference their logged data when it's relevant, but don't be rigid about it
- Keep it natural: 2-4 sentences usually works; longer responses are fine if needed
- Celebrate wins (hydration goals met, protein targets hit) and be supportive on tough days

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
