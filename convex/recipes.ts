import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const saveRecipe = mutation({
  args: {
    userId: v.id('users'),
    recipe: v.object({
      name: v.string(),
      description: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      ingredients: v.array(v.string()),
      instructions: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Check if recipe already exists (by name)
    const existing = await ctx.db
      .query('savedRecipes')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .filter(r => r.eq(r.field('name'), args.recipe.name))
      .first();

    if (existing) {
      return { saved: false, message: 'Recipe already saved' };
    }

    const recipeId = await ctx.db.insert('savedRecipes', {
      userId: args.userId,
      ...args.recipe,
      source: 'generated',
      savedAt: Date.now(),
    });

    return { saved: true, recipeId };
  },
});

export const deleteSavedRecipe = mutation({
  args: {
    userId: v.id('users'),
    recipeId: v.id('savedRecipes'),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    if (recipe.userId !== args.userId) {
      throw new Error('Unauthorized');
    }

    await ctx.db.delete(args.recipeId);
    return { deleted: true };
  },
});

export const getSavedRecipes = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const recipes = await ctx.db
      .query('savedRecipes')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .order('desc')
      .collect();

    return recipes;
  },
});

export const isSaved = query({
  args: {
    userId: v.id('users'),
    recipeName: v.string(),
  },
  handler: async (ctx, args) => {
    const saved = await ctx.db
      .query('savedRecipes')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .filter(r => r.eq(r.field('name'), args.recipeName))
      .first();

    return !!saved;
  },
});

export const createRecipeShare = mutation({
  args: {
    userId: v.id('users'),
    recipe: v.object({
      name: v.string(),
      description: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      ingredients: v.array(v.string()),
      instructions: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const shareId = crypto.getRandomValues(new Uint8Array(16)).reduce((acc, byte) => {
      return acc + byte.toString(16).padStart(2, '0');
    }, '');

    const id = await ctx.db.insert('recipeShares', {
      userId: args.userId,
      shareId,
      ...args.recipe,
      createdAt: Date.now(),
    });

    return { shareId, id };
  },
});

export const getSharedRecipe = query({
  args: {
    shareId: v.string(),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db
      .query('recipeShares')
      .withIndex('by_shareId', q => q.eq('shareId', args.shareId))
      .first();

    if (!recipe) {
      return null;
    }

    return recipe;
  },
});
