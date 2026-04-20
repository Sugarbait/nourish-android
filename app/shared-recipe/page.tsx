'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Bookmark, Printer, Copy } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface SharedRecipe {
  _id: string;
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  instructions: string[];
  createdAt: number;
  userId: string;
}

function SharedRecipeContent() {
  const searchParams = useSearchParams();
  const shareId = searchParams.get('id');
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const id = typeof window !== 'undefined' ? localStorage.getItem('nourish_user_id') : null;
    setUserId(id);
  }, []);

  const recipe = useQuery(api.recipes.getSharedRecipe, shareId ? { shareId } : 'skip');
  const saveRecipeMutation = useMutation(api.recipes.saveRecipe);

  if (!shareId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invalid share link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">The recipe share link is missing an ID parameter.</p>
            <Link href="/">
              <Button className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveRecipe = async () => {
    if (!recipe) return;

    if (!isMounted || !userId) {
      toast({ title: 'Sign in required', description: 'Please sign in to save recipes.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveRecipeMutation({
        userId: userId as any,
        recipe: {
          name: recipe.name,
          description: recipe.description,
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fat: recipe.fat,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
        },
      });

      if (result.saved) {
        toast({ title: 'Recipe saved!', description: `${recipe.name} saved to your recipes.` });
      } else {
        toast({ title: 'Already saved', description: result.message });
      }
    } catch (error: any) {
      toast({ title: 'Sign in required', description: 'Please sign in to save recipes.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!recipe) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${recipe.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
          .nutrition { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
          .nutrition-item { background: #f5f5f5; padding: 10px; border-radius: 4px; text-align: center; }
          .nutrition-item .label { font-size: 12px; color: #666; }
          .nutrition-item .value { font-size: 18px; font-weight: bold; }
          h2 { margin-top: 20px; font-size: 16px; color: #333; }
          ul, ol { margin-left: 20px; }
          li { margin: 5px 0; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>${recipe.name}</h1>
        <p>${recipe.description}</p>

        <div class="nutrition">
          <div class="nutrition-item">
            <div class="label">Calories</div>
            <div class="value">${recipe.calories}</div>
          </div>
          <div class="nutrition-item">
            <div class="label">Protein</div>
            <div class="value">${recipe.protein}g</div>
          </div>
          <div class="nutrition-item">
            <div class="label">Carbs</div>
            <div class="value">${recipe.carbs}g</div>
          </div>
          <div class="nutrition-item">
            <div class="label">Fat</div>
            <div class="value">${recipe.fat}g</div>
          </div>
        </div>

        <h2>Ingredients</h2>
        <ul>
          ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
        </ul>

        <h2>Instructions</h2>
        <ol>
          ${recipe.instructions.map(step => `<li>${step}</li>`).join('')}
        </ol>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copied!', description: 'Recipe link copied to clipboard.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy link.', variant: 'destructive' });
    }
  };

  if (recipe === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Recipe not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">This recipe link may have expired or is invalid.</p>
            <Link href="/">
              <Button className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-lg font-bold">Shared Recipe</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{recipe.name}</CardTitle>
            <CardDescription>{recipe.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nutrition Facts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Calories</p>
                <p className="text-xl font-bold">{recipe.calories}</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Protein</p>
                <p className="text-xl font-bold">{recipe.protein}g</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Carbs</p>
                <p className="text-xl font-bold">{recipe.carbs}g</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Fat</p>
                <p className="text-xl font-bold">{recipe.fat}g</p>
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Ingredients</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>{ing}</li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Instructions</h2>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                {recipe.instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
              <Button onClick={handleSaveRecipe} disabled={isSaving} className="gap-2 flex-1">
                <Bookmark className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Recipe'}
              </Button>
              <Button onClick={handlePrint} variant="outline" className="gap-2 flex-1">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={handleCopyLink} variant="outline" className="gap-2 flex-1">
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-6 p-4 rounded-lg bg-muted text-sm text-muted-foreground">
          <p>This recipe was shared from Nourish. <Link href="/" className="text-primary hover:underline">Get your own nutrition tracker</Link>.</p>
        </div>
      </main>
    </div>
  );
}

export default function SharedRecipePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading recipe...</p>
        </div>
      </div>
    }>
      <SharedRecipeContent />
    </Suspense>
  );
}
