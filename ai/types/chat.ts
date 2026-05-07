import {z} from "zod";

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const MealHistoryItemSchema = z.object({
  name: z.string(),
  calories: z.number(),
});

const MealHistorySchema = z.object({
  name: z.string(), // e.g., Breakfast, Lunch
  items: z.array(MealHistoryItemSchema),
});

export const ChatWithCoachInputSchema = z.object({
  messages: z.array(MessageSchema).describe('The history of the conversation so far.'),
  mealHistory: z.array(MealHistorySchema).describe("The user's meal history for the current day."),
  goals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }).describe("The user's daily nutritional goals."),
  waterIntake: z.number().optional().describe("The user's water intake in glasses for the day."),
  profile: z.object({
    age: z.string().optional(),
    weight: z.string().optional(),
    height: z.string().optional(),
    activityLevel: z.string().optional(),
  }).optional().describe("The user's physical profile data."),
  historicalMeals: z.array(z.any()).optional().describe("The user's meal history for the past year for context and pattern analysis."),
});
export type ChatWithCoachInput = z.infer<typeof ChatWithCoachInputSchema>;


export const ChatWithCoachOutputSchema = z.object({
  response: z.string().describe("The AI coach's response."),
});
export type ChatWithCoachOutput = z.infer<typeof ChatWithCoachOutputSchema>;
