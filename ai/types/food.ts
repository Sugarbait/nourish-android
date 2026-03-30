import {z} from "zod";

export const RecognizeFoodInputSchema = z.object({
  photoDataUri: z
      .string()
      .describe(
          "A photo of food, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
      ),
});
export type RecognizeFoodInput = z.infer<typeof RecognizeFoodInputSchema>;

const FoodItemSchema = z.object({
  name: z.string().describe('The name of the food item.'),
  calories: z.number().describe('The estimated calorie content of the food item.'),
  confidence: z
      .number()
      .describe('The confidence level of the food recognition between 0 and 1.'),
});

export const RecognizeFoodOutputSchema = z.object({
  foodItems: z
      .array(FoodItemSchema)
      .describe('A list of recognized food items and their calorie content.'),
  healthScore: z.number().optional().describe('A health score for the meal from 1 to 100.'),
  healthAnalysis: z.string().optional().describe('A brief analysis of the meal\'s healthiness.'),
});
export type RecognizeFoodOutput = z.infer<typeof RecognizeFoodOutputSchema>;
