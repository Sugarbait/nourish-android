import {z} from "zod";

const DailyGoalsSchema = z.object({
  calories: z.number().describe('The total daily calorie goal.'),
  protein: z.number().describe('The total daily protein goal in grams.'),
  carbs: z.number().describe('The total daily carbohydrate goal in grams.'),
  fat: z.number().describe('The total daily fat goal in grams.'),
});

const CurrentIntakeSchema = z.object({
  calories: z.number().describe("The user's current calorie intake for the day."),
  protein: z.number().describe("The user's current protein intake for the day."),
  carbs: z.number().describe("The user's current carbohydrate intake for the day."),
  fat: z.number().describe("The user's current fat intake for the day."),
});


export const SuggestRecipesInputSchema = z.object({
  goals: DailyGoalsSchema,
  intake: CurrentIntakeSchema,
  dietaryRestrictions: z
      .string()
      .optional()
      .describe('Any dietary restrictions the user has, such as vegetarian or gluten-free.'),
  cuisinePreferences: z
      .string()
      .optional()
      .describe("The user's preferred cuisines, such as Italian or Mexican."),
});
export type SuggestRecipesInput = z.infer<typeof SuggestRecipesInputSchema>;

const RecipeSchema = z.object({
  name: z.string().describe("The name of the recipe."),
  description: z.string().describe("A brief description of the recipe."),
  calories: z.number().describe("Estimated calories for the recipe."),
  protein: z.number().describe("Estimated protein in grams."),
  carbs: z.number().describe("Estimated carbohydrates in grams."),
  fat: z.number().describe("Estimated fat in grams."),
  ingredients: z.array(z.string()).describe("A list of ingredients for the recipe."),
  instructions: z.array(z.string()).describe("Step-by-step instructions to prepare the recipe."),
});

export const SuggestRecipesOutputSchema = z.object({
  recipes: z
      .array(RecipeSchema)
      .describe('An array of suggested recipes that meet the user\'s nutritional goals.'),
});
export type SuggestRecipesOutput = z.infer<typeof SuggestRecipesOutputSchema>;
