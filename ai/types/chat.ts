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
});
export type ChatWithCoachInput = z.infer<typeof ChatWithCoachInputSchema>;


export const ChatWithCoachOutputSchema = z.object({
  response: z.string().describe("The AI coach's response."),
});
export type ChatWithCoachOutput = z.infer<typeof ChatWithCoachOutputSchema>;
