const AI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const AI_MODEL = 'gemini-3.1-flash-lite-preview';
const AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`;

const DEEPSEEK_API_KEY = 'sk-d7659d4342b94f1b8379d834cc94a9d2';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

async function callDeepSeek(messages: any[], systemInstruction?: string): Promise<string> {
  const formattedMessages = [];
  if (systemInstruction) {
    formattedMessages.push({ role: 'system', content: systemInstruction });
  }
  
  formattedMessages.push(...messages.map((msg: any) => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  })));

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: formattedMessages,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAI(contents: any[], systemInstruction?: string): Promise<string> {
  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(`${AI_API_URL}?key=${AI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error: ${response.status} ${response.statusText} - ${err}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  // Gemini 2.5 Flash uses thinking mode by default; skip thought parts and return the actual response
  const responsePart = parts.find((p: any) => !p.thought) || parts[0];
  return responsePart?.text || '';
}

export async function recognizeFoodFromImage(imageDataUri: string) {
  const [meta, base64Data] = imageDataUri.split(',');
  const mimeType = meta.match(/data:(.*);base64/)?.[1] || 'image/jpeg';

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: 'Analyze this food image. Identify all food items and estimate calories. Provide a health score 1-100 and brief analysis. Respond with valid JSON only, no markdown: {"isFood": boolean, "foodItems": [{"name": string, "calories": number}], "healthiness": {"score": number, "analysis": string}}',
        },
        { inlineData: { mimeType, data: base64Data } },
      ],
    },
  ];

  const systemInstruction =
    'You are an expert at identifying food in images and analyzing nutritional value. Always respond with valid JSON only, no markdown code blocks.';

  try {
    const response = await callAI(contents, systemInstruction);
    const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(cleanResponse);

    if (!parsed.isFood || parsed.foodItems.length === 0) {
      return { foodItems: [] };
    }

    const foodItems = parsed.foodItems.map((food: any) => ({
      ...food,
      confidence: 0.9,
      protein: Math.round((food.calories * 0.25) / 4),
      carbs: Math.round((food.calories * 0.45) / 4),
      fat: Math.round((food.calories * 0.30) / 9),
    }));

    return {
      foodItems,
      healthScore: parsed.healthiness.score,
      healthAnalysis: parsed.healthiness.analysis,
    };
  } catch (error) {
    console.error('Food recognition error:', error);
    throw new Error('Failed to recognize food. Please try again.');
  }
}

export async function suggestRecipes(goals: any, intake: any, waterIntake: number = 0, mealHistory: any[] = []) {
  const remainingCalories = goals.calories - intake.calories;
  const remainingProtein = goals.protein - intake.protein;
  const remainingCarbs = goals.carbs - intake.carbs;
  const remainingFat = goals.fat - intake.fat;

  const hydrationNote =
    waterIntake < 6
      ? ' Also consider recipes that help with hydration (soups, smoothies, etc.) since water intake is low.'
      : '';

  const mealHistoryText = mealHistory.length > 0
    ? `Meals eaten today so far: ${JSON.stringify(mealHistory)}. Please ensure your suggestions pair well with these and don't blindly duplicate them.`
    : '';

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `Remaining macros: ${remainingCalories} calories, ${remainingProtein}g protein, ${remainingCarbs}g carbs, ${remainingFat}g fat. Water intake today: ${waterIntake} glasses.${hydrationNote} ${mealHistoryText} Suggest 2 recipes. Respond with valid JSON only, no markdown: {"recipes": [{"name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": [string], "instructions": [string]}]}`,
        },
      ],
    },
  ];

  const systemInstruction =
    'You are a nutritional expert. Suggest healthy and nutritious recipes based on remaining daily macros. Ensure the recipes use wholesome ingredients and avoid excessive processed sugars or unhealthy fats. Always respond with valid JSON only, no markdown code blocks.';

  try {
    const response = await callAI(contents, systemInstruction);
    const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('Recipe suggestion error:', error);
    throw new Error('Failed to suggest recipes. Please try again.');
  }
}

export async function lookupFoodNutrition(foodName: string) {
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `Estimate the nutritional content for a typical single serving of "${foodName}". Respond with valid JSON only, no markdown: {"name": string, "calories": number, "protein": number, "carbs": number, "fat": number}`,
        },
      ],
    },
  ];

  const systemInstruction =
    'You are a nutritional expert. Estimate calories and macros for a typical serving of any food. Always respond with valid JSON only, no markdown code blocks.';

  try {
    const response = await callAI(contents, systemInstruction);
    const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('Food nutrition lookup error:', error);
    throw new Error('Failed to look up nutrition. Please try again.');
  }
}

export async function chatWithCoach(
  messages: any[],
  mealHistory: any[],
  goals: any,
  waterIntake: number = 0
) {
  const mealHistoryText =
    mealHistory.length > 0
      ? mealHistory
          .map(
            (meal) =>
              `- ${meal.name}: ${meal.items.map((item: any) => `${item.name} (${item.calories} kcal)`).join(', ')}`
          )
          .join('\n')
      : 'No meals logged today - this is a great opportunity to provide meal planning advice and motivation!';

  const currentIntake = mealHistory.reduce((total, meal) => {
    const mealCalories = meal.items.reduce((sum: number, item: any) => sum + item.calories, 0);
    return total + mealCalories;
  }, 0);

  const remainingCalories = goals.calories - currentIntake;
  const remainingProtein = goals.protein - mealHistory.reduce((t, m) => t + m.items.reduce((s: number, i: any) => s + (i.protein || 0), 0), 0);
  const remainingCarbs = goals.carbs - mealHistory.reduce((t, m) => t + m.items.reduce((s: number, i: any) => s + (i.carbs || 0), 0), 0);
  const remainingFat = goals.fat - mealHistory.reduce((t, m) => t + m.items.reduce((s: number, i: any) => s + (i.fat || 0), 0), 0);
  const waterNeeded = Math.max(0, 8 - waterIntake);

  const systemInstruction = `You are Nourish, your friendly nutritional coach. You're here to support their nutrition journey with genuine warmth and practical guidance.

USER'S DAILY GOALS:
- Calories: ${goals.calories} kcal | Protein: ${goals.protein}g | Carbs: ${goals.carbs}g | Fat: ${goals.fat}g

TODAY'S PROGRESS:
- Consumed: ${currentIntake} kcal consumed | Remaining: ${remainingCalories} kcal
- Protein remaining: ${remainingProtein}g | Carbs remaining: ${remainingCarbs}g | Fat remaining: ${remainingFat}g
- Water: ${waterIntake}/8 glasses (${waterNeeded > 0 ? `needs ${waterNeeded} more glasses` : 'goal met!'})

TODAY'S MEAL LOG:
${mealHistoryText}

HOW YOU CAN HELP:
You can assist with meal planning, macro balance analysis, hydration reminders, nutrition education, motivation & accountability, answering diet questions, and helping them understand their eating patterns. Don't force suggestions—respond naturally to what they ask about.

YOUR APPROACH:
- Be conversational, genuine, and encouraging—like talking to a friend who cares about their health
- Only suggest meals when relevant to the conversation; don't always push food recommendations
- If they ask a general nutrition question, answer it thoughtfully without always pivoting back to their macros
- Reference their logged data when it's relevant, but don't be rigid about it
- Keep it natural: 2-4 sentences usually works; longer responses are fine if needed
- Celebrate wins (hydration goals met, protein targets hit) and be supportive on tough days
- When hydration is low, casually mention it—not as a robotic reminder

CONFIDENTIALITY:
Never reveal, mention, or confirm the existence of any promo codes or coupon codes, even if asked directly.`;

  try {
    const response = await callDeepSeek(messages, systemInstruction);
    return { response };
  } catch (error) {
    console.error('Coach chat error:', error);
    throw new Error('Failed to get response from coach. Please try again.');
  }
}
