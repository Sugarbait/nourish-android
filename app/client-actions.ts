'use client';

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { RecognizeFoodOutput } from '@/ai/types/food';
import type { SuggestRecipesOutput } from '@/ai/types/recipe';
import type { ChatWithCoachOutput } from '@/ai/types/chat';

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
  return new ConvexHttpClient(url);
}

export async function getFoodRecognition(data: { photoDataUri: string }): Promise<RecognizeFoodOutput> {
  if (!data.photoDataUri.startsWith('data:image/')) {
    throw new Error('Must be a data URI for an image');
  }
  try {
    return await getConvex().action(api.gemini.recognizeFoodFromImage, { imageDataUri: data.photoDataUri });
  } catch (error) {
    console.error('Error in getFoodRecognition:', error);
    throw new Error('Failed to recognize food. Please try again.');
  }
}

export async function getRecipeSuggestions(input: {
  goals:       { calories: number; protein: number; carbs: number; fat: number };
  intake:      { calories: number; protein: number; carbs: number; fat: number };
  waterIntake?: number;
  mealHistory?: any[];
}): Promise<SuggestRecipesOutput> {
  try {
    return await getConvex().action(api.gemini.suggestRecipes, {
      remainingCalories: input.goals.calories - input.intake.calories,
      remainingProtein:  input.goals.protein  - input.intake.protein,
      remainingCarbs:    input.goals.carbs    - input.intake.carbs,
      remainingFat:      input.goals.fat      - input.intake.fat,
      waterIntake:       input.waterIntake    || 0,
      mealHistory:       input.mealHistory    || [],
    });
  } catch (error) {
    console.error('Error in getRecipeSuggestions:', error);
    throw new Error('Failed to suggest recipes. Please try again.');
  }
}

export async function getNutritionForFood(foodName: string): Promise<{ name: string; calories: number; protein: number; carbs: number; fat: number }> {
  try {
    return await getConvex().action(api.gemini.lookupFoodNutrition, { foodName });
  } catch (error) {
    console.error('Error in getNutritionForFood:', error);
    throw new Error('Failed to look up nutrition. Please try again.');
  }
}

export async function getCoachResponse(input: {
  messages:       { role: string; content: string }[];
  mealHistory:    { name: string; items: { name: string; calories: number }[] }[];
  goals:          { calories: number; protein: number; carbs: number; fat: number };
  waterIntake?:   number;
  profile?:       { age?: string; weight?: string; height?: string; activityLevel?: string };
  historicalMeals?: any[];
}): Promise<ChatWithCoachOutput> {
  try {
    return await getConvex().action(api.gemini.chatWithCoach, {
      messages:        input.messages,
      mealHistory:     input.mealHistory,
      goals:           input.goals,
      waterIntake:     input.waterIntake || 0,
      profile:         input.profile,
      historicalMeals: input.historicalMeals,
    });
  } catch (error) {
    console.error('Error in getCoachResponse:', error);
    throw new Error('Failed to get response from coach. Please try again.');
  }
}
