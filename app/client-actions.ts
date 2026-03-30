'use client';

import { recognizeFoodFromImage, suggestRecipes, chatWithCoach } from '@/lib/openai-client';
import type { RecognizeFoodOutput } from '@/ai/types/food';
import type { SuggestRecipesOutput } from '@/ai/types/recipe';
import type { ChatWithCoachOutput } from '@/ai/types/chat';

export async function getFoodRecognition(data: { photoDataUri: string }): Promise<RecognizeFoodOutput> {
  if (!data.photoDataUri.startsWith('data:image/')) {
    throw new Error('Must be a data URI for an image');
  }
  
  try {
    const result = await recognizeFoodFromImage(data.photoDataUri);
    return result;
  } catch (error) {
    console.error('Error in getFoodRecognition:', error);
    throw new Error('Failed to recognize food. Please try again.');
  }
}

export async function getRecipeSuggestions(input: {
  goals: { calories: number; protein: number; carbs: number; fat: number };
  intake: { calories: number; protein: number; carbs: number; fat: number };
  waterIntake?: number;
}): Promise<SuggestRecipesOutput> {
  try {
    const result = await suggestRecipes(input.goals, input.intake, input.waterIntake || 0);
    return result;
  } catch (error) {
    console.error('Error in getRecipeSuggestions:', error);
    throw new Error('Failed to suggest recipes. Please try again.');
  }
}

export async function getCoachResponse(input: {
  messages: { role: string; content: string }[];
  mealHistory: { name: string; items: { name: string; calories: number }[] }[];
  goals: { calories: number; protein: number; carbs: number; fat: number };
  waterIntake?: number;
}): Promise<ChatWithCoachOutput> {
  try {
    const result = await chatWithCoach(input.messages, input.mealHistory, input.goals, input.waterIntake || 0);
    return result;
  } catch (error) {
    console.error('Error in getCoachResponse:', error);
    throw new Error('Failed to get response from coach. Please try again.');
  }
}