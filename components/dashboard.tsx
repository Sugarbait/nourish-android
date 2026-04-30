'use client';

const BUILD_VERSION = "0.2.38";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Camera,
  Plus,
  Sparkles,
  Utensils,
  Flame,
  Soup,
  Beef,
  Wheat,
  Drumstick,
  Loader2,
  Trash2,
  Settings,
  GlassWater,
  Minus,
  Upload,
  Video,
  Power,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  HeartPulse,
  MessageCircle,
  Send,
  User,
  Sparkle,
  Zap,
  CreditCard,
  ChevronDown,
  ExternalLink,
  Pencil,
  Check,
  X,
  MessageSquare,
  Bookmark,
  Share2,
  Printer,
  TrendingUp,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';
import {
  CreditData,
  loadCredits,
  saveCredits,
  consumeMealCredit,
  consumeAICredit,
  availableMealCredits,
  availableAICredits,
  defaultCreditData,
} from '@/lib/credits';
import { PricingModal } from '@/components/pricing-modal';
import { NoCreditsModal } from '@/components/no-credits-modal';
import { GuestUpsellModal } from '@/components/guest-upsell-modal';
import { GoalCelebration } from '@/components/goal-celebration';
import { AuthModal } from '@/components/auth-modal';
import { useAction, useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays, subDays, startOfToday } from 'date-fns';

import { getFoodRecognition, getRecipeSuggestions, getCoachResponse, getNutritionForFood } from '@/app/client-actions';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


import type { RecognizeFoodOutput } from '@/ai/types/food';
import type { SuggestRecipesOutput } from '@/ai/types/recipe';
import { ModeToggle } from './mode-toggle';
import type { ChatWithCoachInput } from '@/ai/types/chat';

type FoodItem = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number;
};

type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

type Meal = {
  id: string;
  name: MealType;
  items: FoodItem[];
  timestamp: number; // Use number for easier serialization
  healthAnalysis?: { score: number; analysis: string };
};

type DailyGoals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number; // in glasses
};

type DailyData = {
    meals: Meal[];
    water: number;
}

type AppData = {
    goals: DailyGoals;
    history: Record<string, DailyData>; // YYYY-MM-DD -> DailyData
}

type Recipe = SuggestRecipesOutput['recipes'][0];

type HealthAnalysis = {
    score: number;
    analysis: string;
}

type ChatMessage = {
    role: 'user' | 'model';
    content: string;
}

const augmentWithMacros = (items: RecognizeFoodOutput['foodItems']): FoodItem[] => {
  return items.map(item => {
    // This is a very rough estimation. A proper implementation would use a food database.
    const { calories } = item;
    const protein = Math.round((calories * 0.25) / 4);
    const carbs = Math.round((calories * 0.45) / 4);
    const fat = Math.round((calories * 0.30) / 9);
    return { ...item, protein, carbs, fat };
  });
};

const manualFoodFormSchema = z.object({
  mealType: z.enum(["Breakfast", "Lunch", "Dinner", "Snacks"], { required_error: "Please select a meal type." }),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required."),
    calories: z.coerce.number().min(0, "Calories must be a positive number."),
    protein: z.coerce.number().min(0, "Protein must be a positive number."),
    carbs: z.coerce.number().min(0, "Carbs must be a positive number."),
    fat: z.coerce.number().min(0, "Fat must be a positive number."),
  })).min(1, "Please add at least one food item.")
});

const goalsFormSchema = z.object({
    calories: z.coerce.number().min(1, "Calories are required"),
    protein: z.coerce.number().min(1, "Protein is required"),
    carbs: z.coerce.number().min(1, "Carbs are required"),
    fat: z.coerce.number().min(1, "Fat is required"),
    water: z.coerce.number().min(1, "Water goal is required"),
});

const APP_STORAGE_KEY = 'nourishai-data';
const PROFILE_STORAGE_KEY = 'nourishai-profile';

const profileFormSchema = z.object({
  name: z.string().optional(),
  age: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  avatar: z.string().optional(),
});

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email("Invalid email address."),
  message: z.string().min(10, "Message must be at least 10 characters."),
});

type UserProfile = z.infer<typeof profileFormSchema>;

const defaultProfile: UserProfile = { name: '', age: '', weight: '', height: '', activityLevel: 'moderate', avatar: '' };

function CircularProgress({ value, max, color, size = 80, strokeWidth = 8, children }: {
  value: number; max: number; color: string; size?: number; strokeWidth?: number; children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/40" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="relative flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// Parse formatted text and return JSX elements
function parseFormattedText(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\*\*(.+?)\*\*|__(.+?)__|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|_(.+?)_|\[(.+?)\]\((.+?)\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      elements.push(<strong key={`b-${match.index}`}>{match[1]}</strong>);
    } else if (match[2]) {
      elements.push(<u key={`u-${match.index}`}>{match[2]}</u>);
    } else if (match[3]) {
      elements.push(<em key={`i1-${match.index}`}>{match[3]}</em>);
    } else if (match[4]) {
      elements.push(<em key={`i2-${match.index}`}>{match[4]}</em>);
    } else if (match[5] && match[6]) {
      elements.push(
        <a key={`a-${match.index}`} href={match[6]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {match[5]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}

type TypewriterMessageProps = {
  content: string;
  isLoading?: boolean;
};

function TypewriterMessage({ content, isLoading = false }: TypewriterMessageProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    if (displayedText.length < content.length) {
      const timer = setTimeout(() => {
        setDisplayedText(content.slice(0, displayedText.length + 1));
      }, 15);
      return () => clearTimeout(timer);
    } else {
      setIsComplete(true);
    }
  }, [displayedText, content, isLoading]);

  const textToDisplay = isLoading ? content : displayedText;
  const parsedContent = parseFormattedText(textToDisplay);

  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed">
      {parsedContent}
      {!isComplete && !isLoading && <span className="animate-pulse">|</span>}
    </div>
  );
}

export function Dashboard({ isGuest: _isGuestProp = false }: { isGuest?: boolean }) {
  const { toast } = useToast();
  const getBillingPortalUrl = useAction(api.stripeActions.getBillingPortalUrl);
  const convexLogMeal = useMutation(api.meals.logMeal);
  const convexDeleteMeal = useMutation(api.meals.deleteMealByLocalId);
  const convexUpdateMealItem = useMutation(api.meals.updateMealItem);
  const convexUpdateMealType = useMutation(api.meals.updateMealType);
  const convexUpdateProfile = useMutation(api.users.updateProfile);
  const convexRedeemCoupon = useMutation(api.users.redeemCoupon);
  const convexConsumeMealCredit = useMutation(api.users.consumeMealCredit);
  const submitContactForm = useAction(api.contact.submitContactForm);
  const convexDeleteSavedRecipe = useMutation(api.recipes.deleteSavedRecipe);
  const convexSyncBatchMeals = useMutation(api.meals.syncBatchMeals);
  const convexSyncBatchWater = useMutation(api.waterLogs.syncBatchWater);

  const [couponCode, setCouponCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Auth state from localStorage
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem('nourish_user_id');
    // Basic validation to ensure it's not a junk string from previous versions
    if (id && (id === 'guest' || id.length < 10)) {
      localStorage.removeItem('nourish_user_id');
      setUserId(null);
    } else {
      setUserId(id);
    }
    setIsAuthLoading(false);
  }, []);

  const isAuthenticated = !!userId;
  const isGuest = !isAuthenticated;

  // dateKey must be derived before useQuery hooks so it can be passed as a query arg
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  const stripeCustomerId = useQuery(api.stripe.getStripeCustomerId, userId ? { userId } : 'skip');
  // Fetch meals for the currently selected date from Convex (cross-device hydration)
  const selectedDateConvexMeals = useQuery(api.meals.getMealsForDate, userId ? { userId: userId as any, date: dateKey } : 'skip');
  // Fetch credits from Convex — source of truth for all authenticated users
  const convexCredits = useQuery(api.users.getCredits, userId ? { userId: userId as any } : 'skip');
  const convexProfile = useQuery(api.users.getProfile, userId ? { userId: userId as any } : 'skip');
  const savedRecipes = useQuery(api.recipes.getSavedRecipes, userId ? { userId: userId as any } : 'skip') ?? [];

  const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  const recentMeals = useQuery(api.meals.getMealsForDateRange, userId ? { userId: userId as any, startDate: sevenDaysAgo, endDate: today } : 'skip');
  const trackedDates = useQuery(api.meals.getTrackedDates, userId ? { userId: userId as any } : 'skip');

  const trackedDateObjects = useMemo(() => {
    if (!trackedDates) return [];
    return trackedDates
      .map(d => new Date(d + 'T12:00:00'))
      .filter(d => !isNaN(d.getTime()));
  }, [trackedDates]);

  // Read user display info from localStorage
  const userName = typeof window !== 'undefined' ? localStorage.getItem('nourish_user_name') : null;
  const userAvatar = typeof window !== 'undefined' ? localStorage.getItem('nourish_user_avatar') : null;
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('nourish_user_email') : null;

  // Microsoft OAuth now uses PKCE auth code flow — redirect lands on '/' which handles
  // the token exchange and then redirects here. No hash token handling needed.

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const healthAnalysisRef = useRef<HTMLDivElement>(null);
  const calorieRef = useRef<HTMLParagraphElement>(null);
  
  const [isMounted, setIsMounted] = useState(false);
  // selectedDate and dateKey moved above useQuery hooks
  const [goals, setGoals] = useState<DailyGoals>({ calories: 2200, protein: 150, carbs: 250, fat: 70, water: 8 });
  // Use convexProfile directly for display to avoid flash of default values during hydration
  const displayGoals = (!isGuest && convexProfile)
    ? { calories: convexProfile.calorieGoal, protein: convexProfile.proteinGoal, carbs: convexProfile.carbsGoal, fat: convexProfile.fatGoal, water: convexProfile.waterGoal }
    : goals;
  const [history, setHistory] = useState<Record<string, DailyData>>({});

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiResults, setAiResults] = useState<FoodItem[]>([]);
  const [aiHealthAnalysis, setAiHealthAnalysis] = useState<HealthAnalysis | null>(null);
  
  const [recipeSuggestions, setRecipeSuggestions] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  
  const [isManualEntryOpen, setManualEntryOpen] = useState(false);
  const [isGoalsOpen, setGoalsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
      const name = localStorage.getItem('nourish_user_name');
      const avatar = localStorage.getItem('nourish_user_avatar');
      if (name || avatar) {
        return { ...defaultProfile, name: name || '', avatar: avatar || '' };
      }
    }
    return defaultProfile;
  });

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [coachInput, setCoachInput] = useState("");
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  const [credits, setCredits] = useState<CreditData>(defaultCreditData());
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [noCreditsType, setNoCreditsType] = useState<'meal' | 'ai' | 'recipe'>('meal');
  const [guestUpsellOpen, setGuestUpsellOpen] = useState(false);
  const [guestUpsellType, setGuestUpsellType] = useState<'scan' | 'coach'>('scan');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signup');

  const [celebrationGoal, setCelebrationGoal] = useState<{ name: string; emoji: string; message: string } | null>(null);
  const celebratedRef = useRef<Set<string>>(new Set());
  const notifiedRef = useRef<Set<string>>(new Set());

  const [editingFoodItem, setEditingFoodItem] = useState<{ mealId: string; itemIndex: number; value: string } | null>(null);

  const [isContactSubmitting, setIsContactSubmitting] = useState(false);

  const contactForm = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: userName || "",
      email: userEmail || "",
      message: "",
    },
  });

  // Sync contact form values when user details are available/change
  useEffect(() => {
    if (userName) contactForm.setValue('name', userName);
    if (userEmail) contactForm.setValue('email', userEmail);
  }, [userName, userEmail, contactForm]);
  const [isLookingUpNutrition, setIsLookingUpNutrition] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    newMeal: Meal;
    duplicateOfId: string;
    foodWithMacros: FoodItem[];
  } | null>(null);

  const handleDuplicateReplace = async () => {
    if (!pendingDuplicate) return;
    const { newMeal, duplicateOfId, foodWithMacros } = pendingDuplicate;
    // Remove the old meal first
    await removeMeal(duplicateOfId);
    // Log the new meal
    setHistory(current => ({
      ...current,
      [dateKey]: {
        meals: [...(current[dateKey]?.meals || []), newMeal],
        water: current[dateKey]?.water || 0,
      },
    }));
    if (userId) {
      try {
        const totals = foodWithMacros.reduce(
          (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        await convexLogMeal({
          userId: userId as any,
          date: dateKey,
          mealType: newMeal.name.toLowerCase() as any,
          name: newMeal.name,
          ...totals,
          healthScore: newMeal.healthAnalysis?.score,
          healthAnalysis: newMeal.healthAnalysis?.analysis,
          items: foodWithMacros,
          localId: newMeal.id,
        });
        toast({ title: `Replaced in ${newMeal.name}!`, description: 'Older entry was replaced. Review the results below.' });
      } catch (error) {
        console.error("Failed to replace meal:", error);
        toast({ title: "Failed to replace meal", description: "Please try again.", variant: "destructive" });
      }
    } else {
      toast({ title: `Replaced in ${newMeal.name}!`, description: 'Older entry was replaced. Review the results below.' });
    }
    setPendingDuplicate(null);
  };

  const handleDuplicateLogAgain = async () => {
    if (!pendingDuplicate) return;
    const { newMeal, foodWithMacros } = pendingDuplicate;
    // Append duplicate entry alongside the existing one
    setHistory(current => ({
      ...current,
      [dateKey]: {
        meals: [...(current[dateKey]?.meals || []), newMeal],
        water: current[dateKey]?.water || 0,
      },
    }));
    if (userId) {
      try {
        const totals = foodWithMacros.reduce(
          (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        await convexLogMeal({
          userId: userId as any,
          date: dateKey,
          mealType: newMeal.name.toLowerCase() as any,
          name: newMeal.name,
          ...totals,
          healthScore: newMeal.healthAnalysis?.score,
          healthAnalysis: newMeal.healthAnalysis?.analysis,
          items: foodWithMacros,
          localId: newMeal.id,
        });
        toast({ title: `Added to ${newMeal.name}!`, description: 'Food logged as a duplicate. Review the results below.' });
      } catch (error) {
        console.error("Failed to log duplicate meal:", error);
        toast({ title: "Failed to log meal", description: "Please try again.", variant: "destructive" });
      }
    } else {
      toast({ title: `Added to ${newMeal.name}!`, description: 'Food logged as a duplicate. Review the results below.' });
    }
    setPendingDuplicate(null);
  };

  const handleDuplicateCancel = () => {
    setPendingDuplicate(null);
    toast({ title: 'Cancelled', description: 'Duplicate scan discarded.' });
  };

  const dailyData: DailyData = history[dateKey] || { meals: [], water: 0 };
  
  const convexSetWater = useMutation(api.waterLogs.setWaterGlasses);
  const convexWaterData = useQuery(api.waterLogs.getWaterForDate, !isGuest && userId ? { userId: userId as any, date: dateKey } : 'skip');

  // Hydrate water from Convex
  useEffect(() => {
    if (convexWaterData !== undefined) {
      setHistory(current => {
        const currentWater = current[dateKey]?.water || 0;
        if (currentWater === convexWaterData) return current; // No change needed

        return { ...current, [dateKey]: { meals: current[dateKey]?.meals || [], water: convexWaterData } };
      });
    }
  }, [convexWaterData, dateKey]);


  const manualForm = useForm<z.infer<typeof manualFoodFormSchema>>({
    resolver: zodResolver(manualFoodFormSchema),
    defaultValues: {
      mealType: "Breakfast",
      items: [{ name: "", calories: 0, protein: 0, carbs: 0, fat: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: manualForm.control,
    name: "items"
  });

  const goalsForm = useForm<z.infer<typeof goalsFormSchema>>({
      resolver: zodResolver(goalsFormSchema),
      defaultValues: goals,
  });

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
      resolver: zodResolver(profileFormSchema),
      defaultValues: defaultProfile,
  });

  // Load data from localStorage on mount
  useEffect(() => {
    try {
        const savedData = localStorage.getItem(APP_STORAGE_KEY);
        if (savedData) {
            const parsedData: AppData = JSON.parse(savedData);
            const loadedGoals: DailyGoals = { ...parsedData.goals, water: parsedData.goals.water ?? 8 };
            setGoals(loadedGoals);
            setHistory(parsedData.history);
            goalsForm.reset(loadedGoals);
        }
        const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (savedProfile) {
            const parsedProfile: UserProfile = JSON.parse(savedProfile);
            setProfile(parsedProfile);
            profileForm.reset(parsedProfile);
        }
        setCredits(loadCredits());
    } catch (error) {
        console.error("Failed to load data from localStorage", error);
        toast({ title: "Could not load saved data", variant: 'destructive' });
    }
    setIsMounted(true);
    // Load notification state from localStorage to persist across page refreshes
    try {
      const savedNotified = localStorage.getItem('nourish-notifications-sent');
      if (savedNotified) {
        const notified = JSON.parse(savedNotified);
        notifiedRef.current = new Set(notified);
      }
    } catch (error) {
      console.error("Failed to load notification state", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate React state from convexProfile for authenticated users
  useEffect(() => {
    if (!isGuest && convexProfile) {
      const loadedGoals = {
        calories: convexProfile.calorieGoal,
        protein: convexProfile.proteinGoal,
        carbs: convexProfile.carbsGoal,
        fat: convexProfile.fatGoal,
        water: convexProfile.waterGoal,
      };
      setGoals(loadedGoals);
      goalsForm.reset(loadedGoals);

      const loadedProfile: UserProfile = {
        name: convexProfile.name || '',
        age: convexProfile.age || '',
        weight: convexProfile.weight || '',
        height: convexProfile.height || '',
        activityLevel: (convexProfile.activityLevel as any) || 'moderate',
        avatar: convexProfile.avatar || '',
      };
      setProfile(loadedProfile);
      profileForm.reset(loadedProfile);
    }
  }, [convexProfile, isGuest, goalsForm, profileForm]);

  // Cross-device hydration: when Convex returns meals for the selected date, merge any
  // that aren't already in local state (identified by localId stored in Convex).
  useEffect(() => {
    if (!selectedDateConvexMeals || selectedDateConvexMeals.length === 0) return;
    setHistory(current => {
      const existing = current[dateKey]?.meals || [];
      const existingIds = new Set(existing.map(m => m.id));
      const toMerge: Meal[] = selectedDateConvexMeals
        .filter((cm: any) => cm.localId && !existingIds.has(cm.localId))
        .map((cm: any) => ({
          id: cm.localId as string,
          name: cm.name as MealType,
          items: cm.items,
          timestamp: cm.createdAt,
          healthAnalysis: (cm.healthScore && cm.healthAnalysis)
            ? { score: cm.healthScore, analysis: cm.healthAnalysis }
            : undefined,
        }));
      if (toMerge.length === 0) return current;
      return {
        ...current,
        [dateKey]: {
          meals: [...existing, ...toMerge],
          water: current[dateKey]?.water || 0,
        },
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateConvexMeals, dateKey]);

  // Sync credits from Convex — authoritative source of truth.
  // Runs whenever convexCredits changes (e.g. after a purchase webhook fires).
  useEffect(() => {
    if (!convexCredits) return;
    setCredits(prev => {
      const merged = {
        ...prev,
        credits: convexCredits.credits ?? prev.credits,
        lastFreeDate: convexCredits.lastFreeDate ?? prev.lastFreeDate,
        dailyFreeMealUsed: convexCredits.dailyFreeMealUsed ?? prev.dailyFreeMealUsed,
        dailyFreeAIUsed: convexCredits.dailyFreeAIUsed ?? prev.dailyFreeAIUsed,
      };
      saveCredits(merged);
      return merged;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convexCredits]);

  // After Stripe redirects back with ?checkout=success, poll Convex until the
  // webhook has updated the credits/subscription, then sync into localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') return;

    // Remove the query param so a refresh doesn't re-trigger the sync
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    // Poll Convex for up to 15s (webhook may take a moment to fire)
    const currentUserId = localStorage.getItem('nourish_user_id');
    const currentEmail  = localStorage.getItem('nourish_user_email');
    if (!currentUserId && !currentEmail) return;

    const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!CONVEX_URL) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 1500;

    const poll = setInterval(async () => {
      attempts++;
      try {
        // Query Convex for updated subscription state
        const subRes = await fetch(`${CONVEX_URL}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: 'stripe:getSubscription',
            args: { userId: currentUserId ?? '' },
            format: 'json',
          }),
        });
        const subData = await subRes.json();
        const sub = subData?.value;

        // Query Convex for updated credits
        const credRes = await fetch(`${CONVEX_URL}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: 'stripe:getCreditsForSync',
            args: { userId: currentUserId ?? '' },
            format: 'json',
          }),
        });
        const credData = await credRes.json();
        const convexCredits = credData?.value;

        // Only consider success if subscription is active OR credits actually increased
        const prevCredits = loadCredits().credits;
        const creditsIncreased = convexCredits && convexCredits.credits > prevCredits;
        const isActivated = sub?.active === true || creditsIncreased;

        if (isActivated || attempts >= MAX_ATTEMPTS) {
          clearInterval(poll);

          if (isActivated) {
            // Sync Convex state into localStorage — Convex is source of truth,
            // so we replace (not add to) the local credit count.
            const existing = loadCredits();
            const subPlan = sub?.plan === 'yearly' ? 'monthly' as const : 'monthly' as const;
            const merged = {
              ...existing,
              credits: convexCredits?.credits ?? existing.credits,
              dailyFreeMealUsed: convexCredits?.dailyFreeMealUsed ?? existing.dailyFreeMealUsed,
              lastFreeDate: convexCredits?.lastFreeDate ?? existing.lastFreeDate,
              subscription: sub?.active
                ? { active: true, plan: subPlan, expiresAt: sub.expiresAt ? new Date(sub.expiresAt).toISOString() : null }
                : existing.subscription,
            };
            saveCredits(merged);
            setCredits(merged);
            toast({
              title: '🎉 Payment successful!',
              description: sub?.active
                ? `Your Nourish Pro subscription is now active.`
                : 'Your credits have been added to your account.',
            });
          }
        }
      } catch (err) {
        if (attempts >= MAX_ATTEMPTS) clearInterval(poll);
      }
    }, INTERVAL_MS);

    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync OAuth user data (name, avatar) into local profile state from localStorage
  useEffect(() => {
    if (userName || userAvatar) {
      setProfile(prev => ({
        ...prev,
        name: prev.name || userName || '',
        avatar: prev.avatar || userAvatar || '',
      }));
    }
  }, [userName, userAvatar]);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (!isMounted) return; // Don't save initial default state
    if (!isGuest) return; // CLOUD SYNC: Don't save to localStorage if authenticated
    try {
        const dataToSave: AppData = { goals, history };
        localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
        console.error("Failed to save data to localStorage", error);
        toast({ title: "Could not save progress", description: "Your data might not be saved.", variant: 'destructive' });
    }
  }, [goals, history, isMounted, toast]);

  const intake = useMemo(() => {
    return dailyData.meals.reduce((acc, meal) => {
        meal.items.forEach(item => {
            acc.calories += item.calories;
            acc.protein += item.protein;
            acc.carbs += item.carbs;
            acc.fat += item.fat;
        });
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [dailyData]);

  // Goal milestone notifications + celebration
  useEffect(() => {
    if (!isMounted) return;

    // Only fire for today
    const todayKey = format(startOfToday(), 'yyyy-MM-dd');
    if (dateKey !== todayKey) return;

    const checks = [
      { key: 'calories', value: intake.calories,  goal: displayGoals.calories, name: 'Calorie Goal',    emoji: '🔥', message: 'You hit your calorie target for today. Amazing work!' },
      { key: 'protein',  value: intake.protein,   goal: displayGoals.protein,  name: 'Protein Goal',    emoji: '💪', message: 'Protein target crushed! Your muscles will thank you.' },
      { key: 'carbs',    value: intake.carbs,     goal: displayGoals.carbs,    name: 'Carbs Goal',      emoji: '🌾', message: 'Carb goal reached! Great energy balance today.' },
      { key: 'fat',      value: intake.fat,       goal: displayGoals.fat,      name: 'Fat Goal',        emoji: '✨', message: 'Fat target met! Healthy fats are key to wellbeing.' },
      { key: 'water',    value: dailyData.water,  goal: displayGoals.water,    name: 'Hydration Goal',  emoji: '💧', message: 'Fully hydrated! Your body is loving you right now.' },
    ];

    for (const check of checks) {
      if (check.goal <= 0) continue;
      const pct = check.value / check.goal;
      const celebKey = `${dateKey}-${check.key}-100`;
      const notifyKey = `${dateKey}-${check.key}-${Math.floor(pct * 100)}`;

      // 100% reached → celebrate (queue one at a time)
      if (pct >= 1 && !celebratedRef.current.has(celebKey) && !celebrationGoal) {
        celebratedRef.current.add(celebKey);
        setCelebrationGoal({ name: check.name, emoji: check.emoji, message: check.message });
        break;
      }

      // 75% milestone → encouraging toast
      if (pct >= 0.75 && pct < 1 && !notifiedRef.current.has(notifyKey)) {
        notifiedRef.current.add(notifyKey);
        try {
          localStorage.setItem('nourish-notifications-sent', JSON.stringify(Array.from(notifiedRef.current)));
        } catch (error) {
          console.error("Failed to save notification state", error);
        }
        toast({
          title: `Almost there! ${check.emoji}`,
          description: `You're ${Math.round(pct * 100)}% to your ${check.name.toLowerCase()}. Keep it up!`,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intake, dailyData.water, dateKey, isMounted]);


  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setHasCameraPermission(true);
      } catch (error: any) {
        // NotFoundError is expected on devices without a camera (e.g. some desktops)
        if (error.name !== 'NotFoundError' && error.name !== 'DevicesNotFoundError') {
          console.error('Error accessing camera:', error);
        }
        setHasCameraPermission(false);
      }
    };
    getCameraPermission();
  }, []);

  // SYNC: When a guest logs in, sync their local history to Convex
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (!isMounted || isGuest || !userId || hasSyncedRef.current) return;
    
    const syncHistory = async () => {
      try {
        const historyDates = Object.keys(history);
        if (historyDates.length === 0) {
          hasSyncedRef.current = true;
          return;
        }

        const allMeals: any[] = [];
        const allWater: any[] = [];

        historyDates.forEach(date => {
          const dayData = history[date];
          if (dayData.meals) {
            dayData.meals.forEach(meal => {
              allMeals.push({
                date,
                mealType: meal.name as any,
                name: meal.name,
                calories: meal.items.reduce((acc, i) => acc + i.calories, 0),
                protein: meal.items.reduce((acc, i) => acc + i.protein, 0),
                carbs: meal.items.reduce((acc, i) => acc + i.carbs, 0),
                fat: meal.items.reduce((acc, i) => acc + i.fat, 0),
                items: meal.items,
                localId: meal.id,
                healthScore: meal.healthAnalysis?.score,
                healthAnalysis: meal.healthAnalysis?.analysis,
              });
            });
          }
          if (dayData.water > 0) {
            allWater.push({ date, glasses: dayData.water });
          }
        });

        if (allMeals.length > 0) {
          await convexSyncBatchMeals({ userId: userId as any, meals: allMeals });
        }
        if (allWater.length > 0) {
          await convexSyncBatchWater({ userId: userId as any, logs: allWater });
        }
        
        hasSyncedRef.current = true;
        console.log(`Synced ${allMeals.length} meals and ${allWater.length} water logs to Convex.`);
      } catch (error) {
        console.error("Failed to sync history to Convex:", error);
      }
    };

    syncHistory();
  }, [isMounted, isGuest, userId, history, convexSyncBatchMeals, convexSyncBatchWater]);

  const progressData = useMemo(() => {
    if (!recentMeals) return [];
    
    const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return format(d, 'yyyy-MM-dd');
    });

    return last7DaysDates.map(date => {
      const dayMeals = recentMeals.filter(m => m.date === date);
      const totalCalories = dayMeals.reduce((acc, m) => acc + (m.calories || 0), 0);
      const goal = displayGoals.calories || 2000;
      
      let dayName = 'Day';
      try {
        dayName = format(new Date(date + 'T12:00:00'), 'EEE');
      } catch (e) {}

      return {
        name: dayName,
        calories: totalCalories,
        goal: goal,
        isToday: date === format(new Date(), 'yyyy-MM-dd')
      };
    });
  }, [recentMeals, displayGoals.calories]);

  const startCamera = async () => {
    if (hasCameraPermission && !isCameraOn) {
        try {
            const videoConstraints = {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                aspectRatio: { ideal: 16/9 }
            };
            const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraOn(true);
                setImagePreview(null);
                setAiResults([]);
                setAiHealthAnalysis(null);
            }
        } catch (error) {
            console.error("Failed to start camera", error);
            toast({ title: 'Camera Error', description: 'Could not start the camera. Please ensure it is not in use by another application.', variant: 'destructive' });
        }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        setIsCameraOn(false);
    }
  };

  const handleCapturePhoto = () => {
      if (videoRef.current) {
          const canvas = document.createElement('canvas');
          const video = videoRef.current;
          
          // Calculate 16:9 aspect ratio dimensions
          const aspectRatio = 16 / 9;
          let captureWidth = video.videoWidth;
          let captureHeight = video.videoHeight;
          
          // Adjust to maintain 16:9 ratio
          if (captureWidth / captureHeight > aspectRatio) {
              // Video is wider than 16:9, crop width
              captureWidth = captureHeight * aspectRatio;
          } else {
              // Video is taller than 16:9, crop height  
              captureHeight = captureWidth / aspectRatio;
          }
          
          canvas.width = captureWidth;
          canvas.height = captureHeight;
          
          const context = canvas.getContext('2d');
          if (context) {
              // Center the crop
              const startX = (video.videoWidth - captureWidth) / 2;
              const startY = (video.videoHeight - captureHeight) / 2;
              
              context.drawImage(video, startX, startY, captureWidth, captureHeight, 0, 0, captureWidth, captureHeight);
              const dataUri = canvas.toDataURL('image/jpeg', 0.9);
              setImagePreview(dataUri);
              stopCamera();
              runFoodRecognition(dataUri);
          }
      }
  }

  const resetCapture = () => {
      setImagePreview(null);
      setAiResults([]);
      setAiHealthAnalysis(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
      if (hasCameraPermission) {
          startCamera();
      }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      stopCamera();
      setAiResults([]);
      setAiHealthAnalysis(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setImagePreview(dataUri);
        runFoodRecognition(dataUri);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMeal = async (mealId: string) => {
    const previousHistory = history[dateKey];
    setHistory(current => ({
      ...current,
      [dateKey]: {
        meals: (current[dateKey]?.meals || []).filter(m => m.id !== mealId),
        water: current[dateKey]?.water || 0,
      },
    }));
    // Sync deletion to Convex for authenticated users
    if (userId) {
      try {
        await convexDeleteMeal({ userId: userId as any, localId: mealId });
        toast({ title: "Meal deleted", description: "Removed from your meal log." });
      } catch (error) {
        setHistory(current => ({ ...current, [dateKey]: previousHistory }));
        console.error("Failed to delete meal:", error);
        toast({ title: "Failed to delete meal", description: "Please try again.", variant: "destructive" });
      }
    } else {
      toast({ title: "Meal deleted", description: "Removed from your meal log." });
    }
  };

  const updateMealType = async (mealId: string, newType: MealType) => {
    const previousHistory = history[dateKey];
    setHistory(current => ({
      ...current,
      [dateKey]: {
        ...current[dateKey],
        meals: (current[dateKey]?.meals || []).map(m =>
          m.id === mealId ? { ...m, name: newType } : m
        ),
        water: current[dateKey]?.water || 0,
      },
    }));
    // Sync type change to Convex for authenticated users
    if (userId) {
      try {
        await convexUpdateMealType({ userId: userId as any, localId: mealId, mealType: newType.toLowerCase() as any, name: newType });
      } catch (error) {
        setHistory(current => ({ ...current, [dateKey]: previousHistory }));
        console.error("Failed to update meal type:", error);
        toast({ title: "Failed to update meal", description: "Please try again.", variant: "destructive" });
      }
    }
  };

  const confirmFoodEdit = async (mealId: string, itemIndex: number) => {
    if (!editingFoodItem) return;
    const newName = editingFoodItem.value.trim();
    if (!newName) { setEditingFoodItem(null); return; }
    setIsLookingUpNutrition(true);
    try {
      const nutrition = await getNutritionForFood(newName);
      setHistory(current => ({
        ...current,
        [dateKey]: {
          ...current[dateKey],
          water: current[dateKey]?.water || 0,
          meals: (current[dateKey]?.meals || []).map(m => {
            if (m.id !== mealId) return m;
            const updatedItems = m.items.map((item, idx) =>
              idx === itemIndex
                ? { ...item, name: nutrition.name || newName, calories: nutrition.calories, protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat }
                : item
            );
            return { ...m, items: updatedItems };
          }),
        },
      }));
      // Sync item edit to Convex for authenticated users
      if (userId) {
        convexUpdateMealItem({
          userId: userId as any,
          localId: mealId,
          itemIndex,
          name: nutrition.name || newName,
          calories: nutrition.calories,
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
        }).catch(console.error);
      }
      toast({ title: 'Updated!', description: `Nutrition recalculated for "${nutrition.name || newName}".` });
    } catch {
      toast({ title: 'Lookup failed', description: 'Could not fetch nutrition. Please try again.', variant: 'destructive' });
    } finally {
      setIsLookingUpNutrition(false);
      setEditingFoodItem(null);
    }
  };

  const getMealTypeByTime = (): MealType => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Breakfast';
    if (hour >= 11 && hour < 15) return 'Lunch';
    if (hour >= 15 && hour < 18) return 'Snacks';
    return 'Dinner';
  };

  const runFoodRecognition = async (dataUri: string) => {
    if (!isGuest) {
      if (availableMealCredits(credits) <= 0) {
        setNoCreditsType('meal');
        setNoCreditsOpen(true);
        return;
      }
    }

    setIsLoadingAI(true);
    setAiResults([]);
    setAiHealthAnalysis(null);
    try {
      const result = await getFoodRecognition({ photoDataUri: dataUri });
      if (result.foodItems.length === 0) {
        toast({ title: 'No food detected', description: 'We couldn\'t identify any food items in the image. Try a clearer picture or add it manually.' });
      } else {
        // Deduct credit on successful recognition
        const updatedCredits = consumeMealCredit(credits);
        if (updatedCredits) {
          saveCredits(updatedCredits);
          setCredits(updatedCredits);
          if (userId) {
            convexConsumeMealCredit({ userId: userId as any }).catch(console.error);
          }
        }

        const foodWithMacros = augmentWithMacros(result.foodItems);
        if (result.healthScore && result.healthAnalysis) {
            setAiHealthAnalysis({ score: result.healthScore, analysis: result.healthAnalysis });
        }
        setAiResults(foodWithMacros);

        const mealType = getMealTypeByTime();
        const healthData = (result.healthScore && result.healthAnalysis)
          ? { score: result.healthScore, analysis: result.healthAnalysis }
          : undefined;
        const newMeal: Meal = { id: Date.now().toString(), name: mealType, items: foodWithMacros, timestamp: Date.now(), healthAnalysis: healthData };

        const currentDailyMeals = history[dateKey]?.meals || [];
        const duplicateMeal = currentDailyMeals.find(m => 
            m.items.length > 0 &&
            m.items.length === foodWithMacros.length &&
            m.items.every((item) => foodWithMacros.some(ni => ni.name.toLowerCase() === item.name.toLowerCase()))
        );

        if (duplicateMeal) {
            setPendingDuplicate({ newMeal, duplicateOfId: duplicateMeal.id, foodWithMacros });
        } else {
            setHistory(current => ({
              ...current,
              [dateKey]: {
                meals: [...(current[dateKey]?.meals || []), newMeal],
                water: current[dateKey]?.water || 0,
              },
            }));
            
            // Sync new AI-scanned meal to Convex for authenticated users
            if (userId) {
              const totals = foodWithMacros.reduce(
                (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
                { calories: 0, protein: 0, carbs: 0, fat: 0 }
              );
              convexLogMeal({
                userId: userId as any,
                date: dateKey,
                mealType: mealType.toLowerCase() as any,
                name: mealType,
                ...totals,
                healthScore: result.healthScore,
                healthAnalysis: result.healthAnalysis,
                items: foodWithMacros,
                localId: newMeal.id,
              }).catch(console.error);
            }
            toast({ title: `Added to ${mealType}!`, description: 'Food recognized and logged. Review the results below.' });
        }
      }
    } catch (error) {
      toast({ title: 'Recognition failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsLoadingAI(false);
    }
  };


  const addItemsToLog = (items: FoodItem[], mealName: MealType) => {
    const newMeal: Meal = {
        id: Date.now().toString(),
        name: mealName,
        items,
        timestamp: Date.now(),
    };
    setHistory(current => {
        const newDailyData = {
            meals: [...(current[dateKey]?.meals || []), newMeal],
            water: current[dateKey]?.water || 0,
        };
        return { ...current, [dateKey]: newDailyData };
    });
    // Sync manually-entered meal to Convex for authenticated users
    if (userId) {
      const totals = items.reduce(
        (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      convexLogMeal({
        userId: userId as any,
        date: dateKey,
        mealType: mealName.toLowerCase() as any,
        name: mealName,
        ...totals,
        items,
        localId: newMeal.id,
      }).catch(console.error);
    }
    resetCapture();
    toast({ title: 'Meal added!', description: `${mealName} has been added to your log for ${format(selectedDate, 'PPP')}.` });
  };
  
  const handleGetRecipeSuggestions = async () => {
    if (isGuest) {
      setGuestUpsellType('coach');
      setGuestUpsellOpen(true);
      return;
    }

    if (availableAICredits(credits) <= 0) {
      setNoCreditsType('recipe');
      setNoCreditsOpen(true);
      return;
    }

    const updatedCredits = consumeAICredit(credits);
    if (!updatedCredits) {
      setNoCreditsType('recipe');
      setNoCreditsOpen(true);
      return;
    }
    saveCredits(updatedCredits);
    setCredits(updatedCredits);

    setIsLoadingRecipes(true);
    setRecipeSuggestions([]);
    try {
        const mealHistoryForRecipes = dailyData.meals.map(meal => ({
          name: meal.name,
          items: meal.items.map(item => ({
            name: item.name,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
          })),
        }));
        const result = await getRecipeSuggestions({ goals, intake, waterIntake: dailyData.water, mealHistory: mealHistoryForRecipes });
        setRecipeSuggestions(result.recipes);
    } catch (error) {
        toast({ title: 'Could not get recipes', description: (error as Error).message, variant: 'destructive' });
    } finally {
        setIsLoadingRecipes(false);
    }
  };
  
  const handleOpenCoach = useCallback(async () => {
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && isGuest) {
      setGuestUpsellType('coach');
      setGuestUpsellOpen(true);
      return;
    }
    if (!isDev && !credits.subscription?.active && credits.credits <= 0) {
      setNoCreditsType('ai');
      setNoCreditsOpen(true);
      return;
    }

    setIsChatbotOpen(true);
    
    // Simple greeting if conversation is empty
    if (chatMessages.length === 0) {
      let greeting = `Hello! 👋 How can I help you today?`;
      if (profile.name) {
        const firstName = profile.name.split(' ')[0];
        greeting = `Hello ${firstName}! 👋 How can I help you today?`;
      }
      setChatMessages([{ role: 'model', content: greeting }]);
    }
  }, [isGuest, credits.subscription?.active, chatMessages.length, isCoachLoading, dailyData.meals, dailyData.water, goals]);

  const handleManualSubmit = (values: z.infer<typeof manualFoodFormSchema>) => {
    addItemsToLog(values.items, values.mealType);
    setManualEntryOpen(false);
    manualForm.reset({
      mealType: "Breakfast",
      items: [{ name: "", calories: 0, protein: 0, carbs: 0, fat: 0 }],
    });
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim() || !userId) return;
    setIsRedeeming(true);
    try {
      const result = await convexRedeemCoupon({
        userId: userId as any,
        code: couponCode,
      });
      if (result.success) {
        toast({ title: 'Coupon Applied!', description: `You received ${result.reward} credits.`, variant: 'default' });
        setCouponCode('');
        
        // Use functional state update to ensure we have the latest credits object
        setCredits(current => {
          const updated = { 
            ...current, 
            credits: (current.credits || 0) + (result.reward || 0) 
          };
          saveCredits(updated);
          return updated;
        });
        
        // Close profile sheet and open coach directly — skip handleOpenCoach's
        // credit check since we know credits just increased from the redemption
        setIsProfileOpen(false);
        setIsChatbotOpen(true);
        if (chatMessages.length === 0) {
          const firstName = profile.name?.split(' ')[0];
          setChatMessages([{ role: 'model', content: firstName ? `Hello ${firstName}! 👋 How can I help you today?` : `Hello! 👋 How can I help you today?` }]);
        }
      }
    } catch (err: any) {
      // Extract the most meaningful error message from Convex
      let errorMessage = 'Invalid or expired code.';
      if (typeof err?.data === 'string' && err.data.trim()) {
        errorMessage = err.data;
      } else if (err?.data?.message && typeof err.data.message === 'string') {
        errorMessage = err.data.message;
      } else if (err?.message && typeof err.message === 'string') {
        // Strip Convex prefix like "[CONVEX M(users:redeemCoupon)] [Request ID: xxx]"
        const stripped = err.message
          .replace(/\[CONVEX[^\]]*\]\s*/g, '')
          .replace(/\[Request ID:[^\]]*\]\s*/g, '')
          .replace(/\s*Called by client[\s\S]*$/, '')
          .trim();
        if (stripped) errorMessage = stripped;
      }
      console.error('Coupon redemption error:', err);
      toast({ title: 'Coupon Failed', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleContactSubmit = async (values: z.infer<typeof contactFormSchema>) => {
    setIsContactSubmitting(true);
    try {
      await submitContactForm({
        ...values,
        app: "Nourish",
      });
      toast({ title: 'Message Sent!', description: 'Thank you for your feedback. We will get back to you soon.' });
      contactForm.reset({
        name: userName || "",
        email: userEmail || "",
        message: "",
      });
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message || 'Please try again later.', variant: 'destructive' });
    } finally {
      setIsContactSubmitting(false);
    }
  };

  const handleProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
      const updated = { ...profile, ...values };
      setProfile(updated);
      if (isGuest) {
          try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated)); } catch {}
          setIsProfileOpen(false);
          toast({ title: "Profile saved!", description: "Your profile has been updated." });
      } else if (userId) {
          try {
              await convexUpdateProfile({
                  userId: userId as any,
                  name: values.name,
                  age: values.age,
                  weight: values.weight,
                  height: values.height,
                  activityLevel: values.activityLevel,
                  avatar: values.avatar,
              });
              setIsProfileOpen(false);
              toast({ title: "Profile saved!", description: "Your profile has been updated." });
          } catch (error) {
              console.error("Failed to save profile:", error);
              toast({ title: "Failed to save profile", description: "Please try again.", variant: "destructive" });
          }
      }
  };

  const handleGoalsSubmit = async (values: z.infer<typeof goalsFormSchema>) => {
      setGoals(values);
      goalsForm.reset(values);
      if (!isGuest && userId) {
          try {
              await convexUpdateProfile({
                  userId: userId as any,
                  calorieGoal: values.calories,
                  proteinGoal: values.protein,
                  carbsGoal: values.carbs,
                  fatGoal: values.fat,
                  waterGoal: values.water,
              });
              setGoalsOpen(false);
              toast({ title: "Goals updated!", description: "Your daily nutritional goals have been saved."});
          } catch (error) {
              console.error("Failed to save goals:", error);
              toast({ title: "Failed to save goals", description: "Please try again.", variant: "destructive" });
          }
      } else {
          setGoalsOpen(false);
          toast({ title: "Goals updated!", description: "Your daily nutritional goals have been saved."});
      }
  }

  const handleWaterChange = (amount: number) => {
    setHistory(current => {
        const currentWater = current[dateKey]?.water || 0;
        const newWater = Math.max(0, currentWater + amount);
        
        if (!isGuest && userId) {
            convexSetWater({ userId: userId as any, date: dateKey, glasses: newWater }).catch(console.error);
        }

        const newDailyData = {
            meals: current[dateKey]?.meals || [],
            water: newWater,
        };
        return { ...current, [dateKey]: newDailyData };
    });
  };
  
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
        setSelectedDate(startOfToday() > date ? date : startOfToday());
    }
  }

  const handleCoachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachInput.trim() || isCoachLoading) return;

    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && isGuest) {
      setGuestUpsellType('coach');
      setGuestUpsellOpen(true);
      return;
    }

    if (!isDev && availableAICredits(credits) <= 0) {
      setNoCreditsType('ai');
      setNoCreditsOpen(true);
      return;
    }

    if (!isDev) {
      const updatedCredits = consumeAICredit(credits);
      if (!updatedCredits) {
        setNoCreditsType('ai');
        setNoCreditsOpen(true);
        return;
      }
      saveCredits(updatedCredits);
      setCredits(updatedCredits);
    }

    const newUserMessage: ChatMessage = { role: 'user', content: coachInput };
    const newMessages = [...chatMessages, newUserMessage];
    setChatMessages(newMessages);
    setCoachInput("");
    setIsCoachLoading(true);
  
    try {
      const mealHistoryForCoach = dailyData.meals.map(meal => ({
        name: meal.name,
        items: meal.items.map(item => ({
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
        })),
      }));
  
      const coachInputData: ChatWithCoachInput = {
        messages: newMessages,
        mealHistory: mealHistoryForCoach,
        goals: goals,
        waterIntake: dailyData.water,
        profile: {
          age: profile.age,
          weight: profile.weight,
          height: profile.height,
          activityLevel: profile.activityLevel,
        },
      };

      const response = await getCoachResponse(coachInputData);
  
      const coachMessage: ChatMessage = { role: 'model', content: response.response };
      setChatMessages(prev => [...prev, coachMessage]);
    } catch (error) {
      const oldMessages = chatMessages.slice(0, -1);
      toast({ title: 'Coach Error', description: (error as Error).message, variant: 'destructive' });
      setChatMessages(oldMessages);
    } finally {
      setIsCoachLoading(false);
    }
  };

  if (!isMounted) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Loading Nourish…</p>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <img src="/logo.png" alt="Nourish" className="h-8 w-auto" />
          <div className="flex items-center gap-2 sm:gap-3">

            <Dialog open={isManualEntryOpen} onOpenChange={setManualEntryOpen}>
              <DialogTrigger asChild>
                  <Button size="sm" className="rounded-full h-8 sm:h-9 px-2.5 sm:px-4">
                      <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
                      <span className="hidden sm:inline text-xs sm:text-sm">Manual Entry</span>
                  </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                      <DialogTitle>Manual Food Entry</DialogTitle>
                      <DialogDescription>
                          Log your meal by filling out the details below.
                      </DialogDescription>
                  </DialogHeader>
                  <Form {...manualForm}>
                    <form onSubmit={manualForm.handleSubmit(handleManualSubmit)} className="space-y-4">
                        <FormField
                        control={manualForm.control}
                        name="mealType"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Meal Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a meal type" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Breakfast">Breakfast</SelectItem>
                                    <SelectItem value="Lunch">Lunch</SelectItem>
                                    <SelectItem value="Dinner">Dinner</SelectItem>
                                    <SelectItem value="Snacks">Snacks</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />

                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={manualForm.control}
                                            name={`items.${index}.name`}
                                            render={({ field }) => (
                                                <FormItem className="sm:col-span-2">
                                                <FormLabel>Item Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., Apple" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField control={manualForm.control} name={`items.${index}.calories`} render={({ field }) => ( <FormItem><FormLabel>Calories</FormLabel><FormControl><Input type="number" placeholder="kcal" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={manualForm.control} name={`items.${index}.protein`} render={({ field }) => ( <FormItem><FormLabel>Protein</FormLabel><FormControl><Input type="number" placeholder="g" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={manualForm.control} name={`items.${index}.carbs`} render={({ field }) => ( <FormItem><FormLabel>Carbs</FormLabel><FormControl><Input type="number" placeholder="g" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={manualForm.control} name={`items.${index}.fat`} render={({ field }) => ( <FormItem><FormLabel>Fat</FormLabel><FormControl><Input type="number" placeholder="g" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                     </div>
                                     {fields.length > 1 &&
                                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} className="absolute -top-3 -right-3 h-7 w-7">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                     }
                                </div>
                            ))}
                             <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", calories: 0, protein: 0, carbs: 0, fat: 0 })}>
                                <Plus className="mr-2 h-4 w-4" /> Add Another Item
                            </Button>
                        </div>

                        <DialogFooter>
                            <Button type="submit">Add Meal to Log</Button>
                        </DialogFooter>
                    </form>
                  </Form>
              </DialogContent>
            </Dialog>
            {isGuest ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 px-2.5"
                  onClick={() => { setAuthModalTab('signin'); setIsAuthModalOpen(true); }}
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-8 px-2.5"
                  onClick={() => { setAuthModalTab('signup'); setIsAuthModalOpen(true); }}
                >
                  Sign Up
                </Button>
              </div>
            ) : !credits.subscription?.active && credits.credits <= 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs px-3 h-8 hidden sm:flex items-center gap-1.5"
                onClick={() => { setIsPricingOpen(true); }}
              >
                <CreditCard className="h-3.5 w-3.5" /> Pricing
              </Button>
            ) : null}
            <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 p-0">
                  <Avatar className="h-8 w-8">
                    {!isGuest && (profile.avatar || userAvatar) && <AvatarImage src={profile.avatar || userAvatar || ''} alt="Profile" className="object-cover" />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                      {isGuest ? 'G' : profile.name ? profile.name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <div className="flex flex-col items-center gap-3 pb-4">
                    <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
                      <Avatar className="h-20 w-20 border-2 border-primary/20">
                          {(profile.avatar || userAvatar) && <AvatarImage src={profile.avatar || userAvatar || ''} alt={profile.name || 'Profile'} className="object-cover" />}
                          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                              {isGuest ? 'G' : profile.name ? profile.name.charAt(0).toUpperCase() : <User className="h-10 w-10" />}
                          </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const img = new window.Image();
                            img.onload = () => {
                              const SIZE = 256;
                              const canvas = document.createElement('canvas');
                              canvas.width = SIZE;
                              canvas.height = SIZE;
                              const ctx2d = canvas.getContext('2d')!;
                              const scale = Math.max(SIZE / img.width, SIZE / img.height);
                              const w = img.width * scale;
                              const h = img.height * scale;
                              ctx2d.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
                              const compressed = canvas.toDataURL('image/jpeg', 0.75);
                              profileForm.setValue('avatar', compressed);
                              setProfile(prev => ({ ...prev, avatar: compressed }));
                            };
                            img.src = ev.target?.result as string;
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <SheetTitle className="flex items-center justify-center gap-2">
                        {isGuest ? 'Guest' : profile.name || 'Your Profile'}
                        {credits.subscription?.active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/30">
                            <Zap className="h-3 w-3" /> Subscriber
                          </span>
                        )}
                      </SheetTitle>
                      {userEmail && (
                        <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                      )}
                      <SheetDescription className="mt-0.5">Tap photo to change • Manage your personal details</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>
                {isGuest && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-3">
                    <p className="text-sm font-semibold">Create an account to save your profile</p>
                    <p className="text-xs text-muted-foreground">Sign in or sign up to personalise your goals, track your progress and keep your data safe.</p>
                    <SheetClose asChild>
                      <Button className="w-full" onClick={() => { setAuthModalTab('signup'); setIsAuthModalOpen(true); }}>
                        Sign Up Free
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant="outline" className="w-full" onClick={() => { setAuthModalTab('signin'); setIsAuthModalOpen(true); }}>
                        Sign In
                      </Button>
                    </SheetClose>
                  </div>
                )}
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4 mt-2">
                    <FormField control={profileForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Your name" {...field} disabled={isGuest} onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={profileForm.control} name="age" render={({ field }) => (
                      <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" placeholder="e.g. 28" {...field} disabled={isGuest} onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={profileForm.control} name="weight" render={({ field }) => (
                      <FormItem><FormLabel>Weight</FormLabel><FormControl><Input placeholder="e.g. 165 lbs or 75 kg" {...field} disabled={isGuest} onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={profileForm.control} name="height" render={({ field }) => (
                      <FormItem><FormLabel>Height</FormLabel><FormControl><Input placeholder="e.g. 5'10&quot; or 178 cm" {...field} disabled={isGuest} onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={profileForm.control} name="activityLevel" render={({ field }) => (
                      <FormItem><FormLabel>Activity Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select activity level" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="sedentary">Sedentary (little or no exercise)</SelectItem>
                            <SelectItem value="light">Light (1–3 days/week)</SelectItem>
                            <SelectItem value="moderate">Moderate (3–5 days/week)</SelectItem>
                            <SelectItem value="active">Active (6–7 days/week)</SelectItem>
                            <SelectItem value="very_active">Very Active (hard exercise daily)</SelectItem>
                          </SelectContent>
                        </Select>
                      <FormMessage /></FormItem>
                    )} />
                    {/* Credits & Subscription section */}
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3 mt-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" /> Credits &amp; Subscription
                      </h4>
                      <div className="rounded-lg bg-background border border-border/50 p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{availableMealCredits(credits)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Credits available</p>
                      </div>
                      {credits.subscription?.active ? (
                        <div className="flex items-center gap-2 text-xs text-green-500 font-medium">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          Monthly Pro active
                          {credits.subscription.expiresAt && (
                            <span className="text-muted-foreground font-normal ml-auto">
                              renews {new Date(credits.subscription.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Free plan &bull; 1 free scan daily &bull; Subscribe to unlock AI coach
                        </p>
                      )}
                      {credits.subscription?.active ? (
                        <SheetClose asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => { setIsPricingOpen(true); }}
                          >
                            <CreditCard className="h-3.5 w-3.5 mr-2" />
                            Top Up Credits
                          </Button>
                        </SheetClose>
                      ) : (
                        <SheetClose asChild>
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            onClick={() => { setIsPricingOpen(true); }}
                          >
                            <Zap className="h-3.5 w-3.5 mr-2" />
                            Subscribe — $5.99/mo
                          </Button>
                        </SheetClose>
                      )}
                      {userId && credits.subscription?.active && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground hover:text-foreground"
                          onClick={async () => {
                            if (!stripeCustomerId) {
                              toast({ title: 'Could not open billing portal', description: 'No Stripe account linked. Subscribe first.', variant: 'destructive' });
                              return;
                            }
                            try {
                              const result = await getBillingPortalUrl({
                                stripeCustomerId,
                                returnUrl: window.location.href,
                              });
                              if (result.url) {
                                window.location.href = result.url;
                              }
                            } catch (err: any) {
                              toast({ title: 'Could not open billing portal', description: err.message || 'Please try again later.', variant: 'destructive' });
                            }
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-2" />
                          Manage / Cancel Subscription
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Redeem Coupon</span>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Enter code" 
                          value={couponCode} 
                          onChange={(e) => setCouponCode(e.target.value)} 
                          className="h-8 text-sm flex-1"
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          onClick={handleRedeemCoupon} 
                          disabled={isRedeeming || !couponCode.trim()}
                        >
                          {isRedeeming ? '...' : 'Apply'}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 pb-1 border-t mt-2">
                      <span className="text-sm text-muted-foreground">Appearance</span>
                      <ModeToggle />
                    </div>

                    <div className="pt-4 border-t mt-2">
                       <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4 text-primary" /> Contact Us
                      </h4>
                      <p className="text-[11px] text-muted-foreground mb-4">Have feedback or suggestions? We&apos;d love to hear from you.</p>
                      
                      <Form {...contactForm}>
                        <form onSubmit={contactForm.handleSubmit(handleContactSubmit)} className="space-y-3">
                          <FormField control={contactForm.control} name="name" render={({ field }) => (
                            <FormItem><FormControl><Input placeholder="Your Name" {...field} className="h-8 text-xs" /></FormControl><FormMessage className="text-[10px]" /></FormItem>
                          )} />
                          <FormField control={contactForm.control} name="email" render={({ field }) => (
                            <FormItem><FormControl><Input placeholder="Your Email" {...field} className="h-8 text-xs" /></FormControl><FormMessage className="text-[10px]" /></FormItem>
                          )} />
                          <FormField control={contactForm.control} name="message" render={({ field }) => (
                            <FormItem><FormControl><Textarea placeholder="How can we improve Nourish?" {...field} className="min-h-[80px] text-xs resize-none" /></FormControl><FormMessage className="text-[10px]" /></FormItem>
                          )} />
                          <Button type="submit" disabled={isContactSubmitting} className="w-full h-8 text-xs bg-muted hover:bg-muted/70 text-foreground transition-colors">
                            {isContactSubmitting ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Send Message'}
                          </Button>
                        </form>
                      </Form>
                    </div>

                    <SheetFooter className="pt-2">
                      <SheetClose asChild>
                        <Button type="button" variant="outline" className="w-full">Cancel</Button>
                      </SheetClose>
                      {!isGuest && <Button type="submit" className="w-full">Save Profile</Button>}
                    </SheetFooter>
                    {isAuthenticated && (
                      <SheetClose asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            localStorage.removeItem('nourish_user_id');
                            localStorage.removeItem('nourish_user_name');
                            localStorage.removeItem('nourish_user_avatar');
                            localStorage.removeItem('nourish_user_email');
                            window.location.href = '/';
                          }}
                        >
                          <Power className="h-4 w-4 mr-2" /> Sign Out
                        </Button>
                      </SheetClose>
                    )}
                    <p className="text-center text-xs text-muted-foreground mt-4">Build {BUILD_VERSION}</p>
                  </form>
                </Form>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Daily Credits Banner */}
      <div className="sticky top-14 z-10 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-9 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={() => { setIsPricingOpen(true); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Zap className="h-3 w-3 text-primary" />
              <span>
                <span className="font-semibold text-foreground">{availableMealCredits(credits)}</span>
                {' '}credit{availableMealCredits(credits) !== 1 ? 's' : ''} left
              </span>
            </button>
          </div>
          {!credits.subscription?.active && (
            <button
              onClick={() => { setIsPricingOpen(true); }}
              className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <Zap className="h-3 w-3" />
              <span>Subscribe</span>
            </button>
          )}
        </div>
      </div>

      <main className="container mx-auto p-4 md:px-6 pb-10 pt-6">
        <div className="grid gap-8 md:grid-cols-5 lg:grid-cols-3">
          <div className="md:col-span-3 lg:col-span-2 space-y-6">
            <Card className="shadow-xl rounded-2xl border-border/50 overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold"><Camera className="text-primary" /> Snap Your Meal</CardTitle>
                    <CardDescription>Use your camera or upload a photo to instantly identify food for {format(selectedDate, 'PPP')}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative aspect-video w-full rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center bg-muted/30 overflow-hidden">
                        {imagePreview && <Image src={imagePreview} alt="Food preview" fill className="object-cover" />}
                        <video ref={videoRef} className={`w-full h-full aspect-video rounded-md object-cover ${isCameraOn ? 'block' : 'hidden'}`} autoPlay muted playsInline />
                        
                        {!imagePreview && !isCameraOn && (
                            <div className="text-center text-muted-foreground p-4">
                                <Utensils className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                <p className="mt-2 text-sm sm:text-base">Use your camera or upload a photo</p>
                            </div>
                        )}
                    </div>

                    {imagePreview && aiResults.length > 0 && (
                        <div className="flex flex-col items-center gap-1">
                            <p ref={calorieRef} className="text-center text-2xl font-bold">
                                {aiResults.reduce((sum, item) => sum + item.calories, 0)} kcal
                            </p>
                            <button
                                onClick={() => healthAnalysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
                            >
                                <span>Full breakdown below</span>
                                <ChevronDown className="h-4 w-4 animate-bounce" />
                            </button>
                        </div>
                    )}
                    {imagePreview && isLoadingAI && (
                        <p ref={calorieRef} className="text-center text-2xl font-bold text-muted-foreground animate-pulse">
                            Calculating...
                        </p>
                    )}

                    {hasCameraPermission === false && (
                        <Alert variant="destructive">
                            <AlertTitle>Camera Access Required</AlertTitle>
                            <AlertDescription>
                                To use the camera feature, please enable camera permissions in your browser settings.
                            </AlertDescription>
                        </Alert>
                    )}

                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" id="food-upload"/>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                        {isCameraOn ? (
                             <>
                                <Button onClick={handleCapturePhoto} className="flex-1 rounded-full">
                                    <Camera className="mr-2"/> Capture Photo <span className="opacity-70 ml-1.5 text-[10px] font-medium border rounded-full px-1.5 py-0.5 border-current">(1 credit)</span>
                                </Button>
                                <Button onClick={stopCamera} variant="outline" className="flex-1 rounded-full">
                                    <Power className="mr-2"/> Stop Camera
                                </Button>
                            </>
                        ) : imagePreview ? (
                            <div className="flex w-full">
                                <Button onClick={resetCapture} variant="outline" className="flex-1 rounded-full">
                                    <RefreshCcw className="mr-2"/> Retake
                                </Button>
                            </div>
                        ): (
                            <>
                                <Button onClick={startCamera} disabled={hasCameraPermission === false} className="flex-1 rounded-full">
                                    <Video className="mr-2"/> Start Camera
                                </Button>
                                <Button asChild className="flex-1 rounded-full">
                                    <label htmlFor="food-upload" className="cursor-pointer flex items-center justify-center">
                                        <Upload className="mr-2"/> Upload Photo <span className="opacity-70 ml-1.5 text-[10px] font-medium border rounded-full px-1.5 py-0.5 border-current">(1 credit)</span>
                                    </label>
                                </Button>
                            </>
                        )}
                    </div>
              </CardContent>

                {(isLoadingAI || aiResults.length > 0) && (
                    <CardFooter ref={resultsRef} className="flex-col items-start gap-4">
                        <h3 className="font-semibold text-lg">AI Recognition Results</h3>
                        {isLoadingAI && (
                            <div className="w-full space-y-2">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        )}
                        {(isLoadingAI || aiResults.length > 0) && (
                            <div className="w-full space-y-4">
                                <Card ref={healthAnalysisRef}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><HeartPulse /> Health Analysis</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                                        {isLoadingAI && !aiHealthAnalysis ? (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="text-sm">Analyzing your meal...</span>
                                            </div>
                                        ) : aiHealthAnalysis ? (
                                            <>
                                                <div className="relative w-24 h-24 flex-shrink-0">
                                                    <svg className="w-full h-full" viewBox="0 0 36 36">
                                                        <path className="text-muted" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                                                        <path className="text-primary"
                                                            stroke="currentColor"
                                                            strokeWidth="3"
                                                            strokeDasharray={`${aiHealthAnalysis.score}, 100`}
                                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                            fill="none"
                                                        ></path>
                                                    </svg>
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-2xl font-bold">{aiHealthAnalysis.score}</span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-muted-foreground flex-1">{aiHealthAnalysis.analysis}</p>
                                            </>
                                        ) : null}
                                    </CardContent>
                                </Card>
                                {aiResults.length > 0 && (
                                    <>
                                    <div className="space-y-2">
                                        {aiResults.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                                                <div>
                                                    <p className="font-medium">{item.name}</p>
                                                    <p className="text-sm text-muted-foreground">{item.calories} kcal</p>
                                                </div>
                                                <Badge variant="secondary" className="hidden sm:inline-flex">
                                                    {item.confidence ? `~${Math.round(item.confidence * 100)}% Conf.` : 'Manual'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="w-full mt-2 flex flex-col gap-2">
                                        <div className="flex items-center justify-center gap-2 rounded-full bg-primary/10 text-primary text-sm font-medium py-2 px-4">
                                            <Plus className="h-4 w-4" /> Logged to {getMealTypeByTime()}
                                        </div>
                                        <Button variant="outline" className="w-full rounded-full" onClick={resetCapture}>
                                            <RefreshCcw className="mr-2 h-4 w-4" /> Log Another
                                        </Button>
                                    </div>
                                    </>
                                )}
                            </div>
                        )}
                    </CardFooter>
                )}
            </Card>

             {(!isGuest && !convexProfile) ? (
                <Card className="shadow-xl rounded-2xl border-border/50 overflow-hidden">
                  <CardContent className="pt-8"><Skeleton className="h-48 w-full rounded-lg" /></CardContent>
                </Card>
              ) : (
              <Card className="shadow-xl rounded-2xl border-border/50 overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold">
                        <div className="flex items-center gap-2"><Flame className="text-orange-400"/> Today's Summary</div>
                    </CardTitle>
                    <CardDescription>Your progress towards your daily goals for {format(selectedDate, 'PPP')}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pb-6">
                    {/* Big calories ring */}
                    <div className="flex flex-col items-center gap-1 pt-2">
                        <CircularProgress value={intake.calories} max={displayGoals.calories} color="#f97316" size={148} strokeWidth={13}>
                            <span className="text-3xl font-black tracking-tight">{intake.calories}</span>
                            <span className="text-[11px] text-muted-foreground font-semibold">/ {displayGoals.calories} kcal</span>
                        </CircularProgress>
                        <span className="text-sm font-semibold flex items-center gap-1.5 mt-1 text-orange-400"><Flame className="h-4 w-4" />Calories</span>
                    </div>
                    {/* Macro rings row */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center gap-1.5">
                            <CircularProgress value={intake.protein} max={displayGoals.protein} color="#ef4444" size={80} strokeWidth={7}>
                                <span className="text-base font-bold">{intake.protein}g</span>
                            </CircularProgress>
                            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Drumstick className="h-3 w-3 text-red-400"/>Protein</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                            <CircularProgress value={intake.carbs} max={displayGoals.carbs} color="#eab308" size={80} strokeWidth={7}>
                                <span className="text-base font-bold">{intake.carbs}g</span>
                            </CircularProgress>
                            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Wheat className="h-3 w-3 text-yellow-400"/>Carbs</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                            <CircularProgress value={intake.fat} max={displayGoals.fat} color="#a855f7" size={80} strokeWidth={7}>
                                <span className="text-base font-bold">{intake.fat}g</span>
                            </CircularProgress>
                            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Beef className="h-3 w-3 text-purple-400"/>Fat</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            )}

            {isMounted && isAuthenticated && progressData.length > 0 && (
                <Card className="shadow-xl rounded-2xl border-border/50 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <TrendingUp className="text-primary h-5 w-5" /> Weekly Progress
                        </CardTitle>
                        <CardDescription>Your calorie intake over the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[220px] pt-4 pr-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={progressData}>
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                                />
                                <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, displayGoals.calories) * 1.1]} />
                                <Tooltip 
                                    cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                                                    <p className="font-bold mb-1">{data.name}</p>
                                                    <p className="text-primary">{data.calories} / {data.goal} kcal</p>
                                                    <p className="text-muted-foreground">{data.goal > 0 ? Math.round((data.calories / data.goal) * 100) : 0}% of goal</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <ReferenceLine y={displayGoals.calories} stroke="hsl(var(--primary) / 0.3)" strokeDasharray="3 3" />
                                <Bar dataKey="calories" radius={[4, 4, 0, 0]} barSize={32}>
                                    {progressData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.calories > entry.goal ? 'hsl(var(--destructive))' : (entry.isToday ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.4)')} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}


            <Card className="shadow-xl rounded-2xl border-border/50">
                <CardHeader>
                    <CardTitle className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xl font-bold"><Utensils className="text-primary"/> Meal History</div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(selectedDate, 'PPP')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={handleDateChange}
                                        disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                                        initialFocus
                                        modifiers={{ tracked: trackedDateObjects }}
                                        modifiersClassNames={{ tracked: "day-tracked" }}
                                    />
                                </PopoverContent>
                            </Popover>
                             <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={selectedDate >= startOfToday()}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardTitle>
                    <CardDescription>A log of all your meals for the selected day.</CardDescription>
                </CardHeader>
                <CardContent>
                    {dailyData.meals.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full" defaultValue={`meal-${dailyData.meals[0].id}`}>
                            {dailyData.meals.map(meal => (
                                <AccordionItem value={`meal-${meal.id}`} key={meal.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between w-full pr-4">
                                            <span className='font-semibold'>{meal.name}</span>
                                            <span className="text-muted-foreground">{meal.items.reduce((acc, i) => acc + i.calories, 0)} kcal</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="space-y-2 pl-2 pt-1">
                                            {meal.items.map((item, index) => (
                                                <li key={index} className="flex justify-between items-center text-sm gap-2">
                                                    {editingFoodItem?.mealId === meal.id && editingFoodItem?.itemIndex === index ? (
                                                        <div className="flex items-center gap-1 flex-1">
                                                            <input
                                                                className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                                                value={editingFoodItem.value}
                                                                onChange={e => setEditingFoodItem({ ...editingFoodItem, value: e.target.value })}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') confirmFoodEdit(meal.id, index);
                                                                    if (e.key === 'Escape') setEditingFoodItem(null);
                                                                }}
                                                                autoFocus
                                                                disabled={isLookingUpNutrition}
                                                            />
                                                            <button
                                                                className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted disabled:opacity-50"
                                                                onClick={() => confirmFoodEdit(meal.id, index)}
                                                                disabled={isLookingUpNutrition}
                                                            >
                                                                {isLookingUpNutrition ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
                                                            </button>
                                                            <button
                                                                className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted disabled:opacity-50"
                                                                onClick={() => setEditingFoodItem(null)}
                                                                disabled={isLookingUpNutrition}
                                                            >
                                                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            className="flex items-center gap-1.5 text-left flex-1 group hover:text-primary transition-colors"
                                                            onClick={() => setEditingFoodItem({ mealId: meal.id, itemIndex: index, value: item.name })}
                                                        >
                                                            <span>{item.name}</span>
                                                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                                                        </button>
                                                    )}
                                                    <span className="text-muted-foreground shrink-0">{item.calories} kcal</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {meal.healthAnalysis && (
                                            <details className="mt-3 group">
                                                <summary className="flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer select-none list-none">
                                                    <HeartPulse className="h-3.5 w-3.5" />
                                                    <span>AI Health Analysis</span>
                                                    <span className="ml-auto text-muted-foreground font-normal group-open:hidden">▸ Show</span>
                                                    <span className="ml-auto text-muted-foreground font-normal hidden group-open:inline">▾ Hide</span>
                                                </summary>
                                                <div className="mt-2 rounded-lg border border-border/50 bg-muted/40 p-3 flex items-start gap-3">
                                                    <div className="relative w-12 h-12 flex-shrink-0">
                                                        <svg className="w-full h-full" viewBox="0 0 36 36">
                                                            <path className="text-muted" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                                                            <path className="text-primary" stroke="currentColor" strokeWidth="3" strokeDasharray={`${meal.healthAnalysis.score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"></path>
                                                        </svg>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <span className="text-xs font-bold">{meal.healthAnalysis.score}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-relaxed">{meal.healthAnalysis.analysis}</p>
                                                </div>
                                            </details>
                                        )}
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">Meal type:</span>
                                            <Select value={meal.name} onValueChange={(val) => updateMealType(meal.id, val as MealType)}>
                                                <SelectTrigger className="h-8 w-[130px] text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Breakfast">Breakfast</SelectItem>
                                                    <SelectItem value="Lunch">Lunch</SelectItem>
                                                    <SelectItem value="Dinner">Dinner</SelectItem>
                                                    <SelectItem value="Snacks">Snacks</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" /> Remove Entry
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete this meal entry from your history for {format(selectedDate, 'PPP')}. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction 
                                                        onClick={() => removeMeal(meal.id)}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Delete Entry
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No meals logged for this day.</p>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-xl rounded-2xl border-border/50">
                <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-xl font-bold"><GlassWater className="text-blue-400"/> Water Tracker</CardTitle>
                    <CardDescription>Log your water intake for {format(selectedDate, 'PPP')}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pb-5">
                    <div className="flex justify-center gap-2 flex-wrap">
                        {Array.from({ length: displayGoals.water }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => handleWaterChange(i < dailyData.water ? -(dailyData.water - i) : i + 1 - dailyData.water)}
                                className={`w-10 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                                    i < dailyData.water
                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                                }`}
                            >
                                <GlassWater className="h-5 w-5" />
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between items-center text-sm px-1">
                        <span className="text-muted-foreground font-medium">{dailyData.water} of {displayGoals.water} glasses</span>
                        {dailyData.water >= displayGoals.water && <span className="text-blue-400 font-semibold">✨ Great hydration!</span>}
                    </div>
                </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 lg:col-span-1 space-y-6">

            {/* ── My Goals Card ── */}
            <Card className="shadow-xl rounded-2xl border-border/50 overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-xl font-bold">
                  <div className="flex items-center gap-2"><HeartPulse className="text-primary"/> My Goals</div>
                  <Sheet open={isGoalsOpen} onOpenChange={setGoalsOpen}>
                    <SheetTrigger asChild>
                      <Button size="sm" variant="outline" className="rounded-full h-8 px-3 text-xs gap-1.5">
                        <Settings className="h-3.5 w-3.5"/> Edit Goals
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                      <SheetHeader className="mb-5">
                        <SheetTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary"/> Daily Nutrition Goals</SheetTitle>
                        <SheetDescription>Set your daily targets. Choose a preset to get started, then fine-tune each value.</SheetDescription>
                      </SheetHeader>

                      {/* Preset templates */}
                      <div className="mb-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Presets</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: '🥗 Weight Loss',   values: { calories: 1600, protein: 130, carbs: 160, fat: 55, water: 10 } },
                            { label: '⚖️ Maintenance',   values: { calories: 2200, protein: 150, carbs: 250, fat: 70, water: 8  } },
                            { label: '💪 Muscle Gain',   values: { calories: 2800, protein: 200, carbs: 320, fat: 80, water: 10 } },
                          ].map(preset => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => goalsForm.reset(preset.values)}
                              className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 transition-all p-3 text-center"
                            >
                              <span className="text-xl leading-none">{preset.label.split(' ')[0]}</span>
                              <span className="text-[11px] font-medium text-muted-foreground leading-tight">{preset.label.split(' ').slice(1).join(' ')}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <Form {...goalsForm}>
                        <form onSubmit={goalsForm.handleSubmit(handleGoalsSubmit)} className="space-y-4">
                          {/* Calories */}
                          <FormField control={goalsForm.control} name="calories" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-400"/> Calories (kcal)</FormLabel>
                              <FormControl><Input type="number" placeholder="e.g. 2200" {...field} /></FormControl>
                              <FormDescription className="text-xs">Your total daily calorie target.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          {/* Macros grid */}
                          <div className="grid grid-cols-3 gap-3">
                            <FormField control={goalsForm.control} name="protein" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1 text-xs"><Drumstick className="h-3 w-3 text-red-400"/> Protein (g)</FormLabel>
                                <FormControl><Input type="number" placeholder="150" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={goalsForm.control} name="carbs" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1 text-xs"><Wheat className="h-3 w-3 text-yellow-400"/> Carbs (g)</FormLabel>
                                <FormControl><Input type="number" placeholder="250" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={goalsForm.control} name="fat" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1 text-xs"><Beef className="h-3 w-3 text-purple-400"/> Fat (g)</FormLabel>
                                <FormControl><Input type="number" placeholder="70" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          {/* Water */}
                          <FormField control={goalsForm.control} name="water" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2"><GlassWater className="h-4 w-4 text-blue-400"/> Water (glasses)</FormLabel>
                              <FormControl><Input type="number" placeholder="8" {...field} /></FormControl>
                              <FormDescription className="text-xs">Number of glasses per day (1 glass ≈ 250 ml).</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <SheetFooter className="pt-2 flex gap-2">
                            <SheetClose asChild>
                              <Button type="button" variant="outline" className="flex-1">Cancel</Button>
                            </SheetClose>
                            <Button type="submit" className="flex-1">Save Goals</Button>
                          </SheetFooter>
                        </form>
                      </Form>
                    </SheetContent>
                  </Sheet>
                </CardTitle>
                <CardDescription>Your daily nutrition targets at a glance.</CardDescription>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Calories',  value: `${displayGoals.calories} kcal`, icon: <Flame className="h-4 w-4 text-orange-400"/>,  bg: 'bg-orange-500/10' },
                    { label: 'Protein',   value: `${displayGoals.protein} g`,     icon: <Drumstick className="h-4 w-4 text-red-400"/>,   bg: 'bg-red-500/10' },
                    { label: 'Carbs',     value: `${displayGoals.carbs} g`,       icon: <Wheat className="h-4 w-4 text-yellow-400"/>,     bg: 'bg-yellow-500/10' },
                    { label: 'Fat',       value: `${displayGoals.fat} g`,         icon: <Beef className="h-4 w-4 text-purple-400"/>,      bg: 'bg-purple-500/10' },
                    { label: 'Water',     value: `${displayGoals.water} glasses`, icon: <GlassWater className="h-4 w-4 text-blue-400"/>, bg: 'bg-blue-500/10', full: true },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center gap-3 rounded-xl p-3 ${item.bg} ${item.full ? 'col-span-2' : ''}`}>
                      <div className="shrink-0">{item.icon}</div>
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-bold">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setGoalsOpen(true)}
                  className="mt-3 w-full rounded-xl border border-dashed border-border/60 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  + Tap to adjust goals
                </button>
              </CardContent>
            </Card>

            <Card className="shadow-xl rounded-2xl border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold"><Sparkles className="text-primary"/> Recipe Suggestions</CardTitle>
                    <CardDescription>Not sure what to eat? Get recipe ideas that perfectly fit the rest of your daily goals.</CardDescription>
                </CardHeader>
                <CardContent>
                     {isLoadingRecipes ? (
                        <div className="w-full space-y-4">
                           <Skeleton className="h-24 w-full" />
                           <Skeleton className="h-24 w-full" />
                        </div>
                    ) : recipeSuggestions.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full space-y-2">
                            {recipeSuggestions.map((recipe, index) => (
                                <AccordionItem value={`recipe-${index}`} key={index}>
                                    <AccordionTrigger>
                                        <div className="flex flex-col items-start text-left">
                                            <p className="font-semibold">{recipe.name}</p>
                                            <p className="text-sm text-muted-foreground">{recipe.description}</p>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                            <div className="bg-muted p-2 rounded-md"><p className="text-xs">Calories</p><p className="font-semibold">{recipe.calories}</p></div>
                                            <div className="bg-muted p-2 rounded-md"><p className="text-xs">Protein</p><p className="font-semibold">{recipe.protein}g</p></div>
                                            <div className="bg-muted p-2 rounded-md"><p className="text-xs">Carbs</p><p className="font-semibold">{recipe.carbs}g</p></div>
                                            <div className="bg-muted p-2 rounded-md"><p className="text-xs">Fat</p><p className="font-semibold">{recipe.fat}g</p></div>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold mb-2">Ingredients</h4>
                                            <ul className="list-disc list-inside space-y-1 text-sm">
                                                {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                                            </ul>
                                        </div>
                                         <div>
                                            <h4 className="font-semibold mb-2">Instructions</h4>
                                            <ol className="list-decimal list-inside space-y-1 text-sm">
                                                {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
                                            </ol>
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t">
                                            <RecipeSaveButton recipe={recipe} isAuth={isAuthenticated} userId={userId} />
                                            <RecipeShareButton recipe={recipe} isAuth={isAuthenticated} userId={userId} />
                                            <RecipePrintButton recipe={recipe} />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                         <p className="text-muted-foreground text-center py-4">Click the button to get recipe ideas.</p>
                    )}
                </CardContent>
                <CardFooter>
                     <Button onClick={handleGetRecipeSuggestions} disabled={isLoadingRecipes} className="w-full rounded-full">
                        {isLoadingRecipes ? <Loader2 className="mr-2 animate-spin"/> : <Soup className="mr-2"/>}
                        Suggest Recipes for Today <span className="opacity-70 ml-1.5 text-[10px] font-medium border rounded-full px-1.5 py-0.5 border-current">(1 credit)</span>
                    </Button>
                </CardFooter>
            </Card>

            {/* Saved Recipes */}
            {isAuthenticated && savedRecipes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Bookmark className="text-primary" /> Saved Recipes
                  </CardTitle>
                  <CardDescription>Your personally saved recipes, available anytime.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full space-y-2">
                    {savedRecipes.map((recipe) => (
                      <AccordionItem value={recipe._id} key={recipe._id}>
                        <AccordionTrigger>
                          <div className="flex flex-col items-start text-left">
                            <p className="font-semibold">{recipe.name}</p>
                            <p className="text-sm text-muted-foreground">{recipe.description}</p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            <div className="bg-muted p-2 rounded-md"><p className="text-xs">Calories</p><p className="font-semibold">{recipe.calories}</p></div>
                            <div className="bg-muted p-2 rounded-md"><p className="text-xs">Protein</p><p className="font-semibold">{recipe.protein}g</p></div>
                            <div className="bg-muted p-2 rounded-md"><p className="text-xs">Carbs</p><p className="font-semibold">{recipe.carbs}g</p></div>
                            <div className="bg-muted p-2 rounded-md"><p className="text-xs">Fat</p><p className="font-semibold">{recipe.fat}g</p></div>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Ingredients</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                              {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Instructions</h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm">
                              {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
                            </ol>
                          </div>
                          <div className="flex gap-2 pt-2 border-t">
                            <RecipeShareButton recipe={recipe} isAuth={isAuthenticated} userId={userId} />
                            <RecipePrintButton recipe={recipe} />
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-destructive hover:text-destructive ml-auto"
                              onClick={async () => {
                                try {
                                  await convexDeleteSavedRecipe({ userId: userId as any, recipeId: recipe._id });
                                  toast({ title: 'Recipe removed', description: `${recipe.name} removed from saved recipes.` });
                                } catch {
                                  toast({ title: 'Error', description: 'Failed to remove recipe.', variant: 'destructive' });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Floating Chat Widget — no modal, no overlay, no backdrop */}
      <Button
        onClick={handleOpenCoach}
          className={`fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-2xl shadow-primary/40 hover:shadow-primary/60 hover:scale-105 transition-all duration-200 z-50 bg-primary text-primary-foreground border-2 border-black ${isChatbotOpen ? 'hidden' : ''}`}
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="sr-only">Open AI Coach</span>
        </Button>

      {/* Chat Widget Panel — fixed bottom-right, no overlay/backdrop */}
      {isChatbotOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50 w-full sm:w-[420px] h-[100dvh] sm:h-[600px] sm:max-h-[80vh] flex flex-col bg-background border sm:rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center border-2 border-primary/20 shadow-sm shrink-0">
                <Image src="/ai-coach.png" alt="AI Coach" width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">AI Nutritional Coach</p>
                <p className="text-[11px] text-muted-foreground">Ask anything about nutrition</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChatMessages([])}
                title="Clear conversation"
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Clear messages</span>
              </button>
              <button
                onClick={() => { setIsChatbotOpen(false); setChatMessages([]); }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 py-4">
              {chatMessages.length === 0 && (
                <div className="text-center space-y-4 py-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mx-auto border-4 border-primary/10 shadow-sm shrink-0 relative">
                    <Image src="/ai-coach.png" alt="AI Coach" fill className="object-cover" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Welcome! I'm your AI nutritional coach.</h3>
                    <p className="text-xs text-muted-foreground mb-4">Try one of these:</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        className="h-auto p-2.5 text-xs justify-start"
                        onClick={() => setCoachInput("Can you help me plan my meals for today?")}
                      >
                        <span>💡</span>
                        <span className="font-medium ml-2">Plan my meals</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto p-2.5 text-xs justify-start"
                        onClick={() => setCoachInput("What are some healthy snack ideas?")}
                      >
                        <span>🍎</span>
                        <span className="font-medium ml-2">Healthy snacks</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto p-2.5 text-xs justify-start"
                        onClick={() => setCoachInput("How can I stay hydrated throughout the day?")}
                      >
                        <span>💧</span>
                        <span className="font-medium ml-2">Hydration tips</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto p-2.5 text-xs justify-start"
                        onClick={() => setCoachInput("Can you help me adjust my nutrition goals?")}
                      >
                        <span>🎯</span>
                        <span className="font-medium ml-2">Adjust my goals</span>
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3 px-2">💡 Tip: I can help adjust your nutrition targets anytime—just ask!</p>
                  </div>
                </div>
              )}
              {chatMessages.map((message, index) => (
                <div key={index} className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                  {message.role === 'model' && (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border border-primary/20 relative">
                      <Image src="/ai-coach.png" alt="AI Coach" fill className="object-cover" />
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 py-2 max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {message.role === 'model' ? (
                      <TypewriterMessage content={message.content} isLoading={false} />
                    ) : (
                      <p className="text-xs whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              {isCoachLoading && (
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border border-primary/20 relative">
                    <Image src="/ai-coach.png" alt="AI Coach" fill className="object-cover" />
                  </div>
                  <div className="bg-muted rounded-2xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t px-4 py-3 shrink-0">
            <form onSubmit={handleCoachSubmit} className="flex items-center gap-2">
              <Input
                placeholder="Ask your coach a question... (1 credit)"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                disabled={isCoachLoading}
                className="flex-1 text-sm"
                autoComplete="off"
              />
              <Button type="submit" size="icon" disabled={isCoachLoading || !coachInput.trim()} className="w-9 h-9">
                {isCoachLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                <span className="sr-only">Send Message</span>
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Guest Upsell Modal */}
      <GuestUpsellModal
        open={guestUpsellOpen}
        onOpenChange={setGuestUpsellOpen}
        type={guestUpsellType}
        onSignUp={() => setIsAuthModalOpen(true)}
        onShowPricing={() => setIsPricingOpen(true)}
      />

      {/* Auth Modal (for guest sign-up from within dashboard) */}
      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} defaultTab={authModalTab} />

      <Dialog open={!!pendingDuplicate} onOpenChange={(open) => !open && handleDuplicateCancel()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Duplicate Detected</DialogTitle>
            <DialogDescription className="pt-2 pb-1">
              We noticed you already logged '{pendingDuplicate?.foodWithMacros.map(i => i.name).join(", ")}' today. 
            </DialogDescription>
            <DialogDescription>
              Would you like to replace the previous entry, or log this as an additional meal?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:space-x-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleDuplicateCancel}>Cancel</Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={handleDuplicateReplace}>Replace Previous</Button>
            <Button className="w-full sm:w-auto" onClick={handleDuplicateLogAgain}>Log as Duplicate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Modal (full pricing page) */}
      <PricingModal
        open={isPricingOpen}
        onOpenChange={setIsPricingOpen}
        credits={credits}
        onCreditsUpdate={(updated) => setCredits(updated)}
        isGuest={isGuest}
        onRequestSignIn={() => { setAuthModalTab('signin'); setIsAuthModalOpen(true); }}
        userId={userId}
        userEmail={userEmail}
      />

      {/* Goal Celebration */}
      <GoalCelebration
        open={!!celebrationGoal}
        onClose={() => setCelebrationGoal(null)}
        goalName={celebrationGoal?.name ?? ''}
        emoji={celebrationGoal?.emoji ?? '🎉'}
        message={celebrationGoal?.message ?? ''}
      />

      {/* No Credits Modal (animated paywall shown when credits run out) */}
      <NoCreditsModal
        open={noCreditsOpen}
        onOpenChange={setNoCreditsOpen}
        type={noCreditsType}
        credits={credits}
        onCreditsUpdate={(updated) => setCredits(updated)}
        onShowPricing={() => setIsPricingOpen(true)}
        isGuest={isGuest}
        onRequestSignIn={() => { setAuthModalTab('signin'); setIsAuthModalOpen(true); }}
        userId={userId}
        userEmail={userEmail}
      />

      {/* Footer */}
      <footer className="border-t border-border/40 mt-8 py-5 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Nourish. All rights reserved.</span>
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Recipe action button components
function RecipeSaveButton({ recipe, isAuth, userId }: { recipe: Recipe; isAuth: boolean; userId: string | null }) {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const saveRecipeMutation = useMutation(api.recipes.saveRecipe);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!isAuth || !userId) {
      toast({ title: 'Sign in required', description: 'Please sign in to save recipes.' });
      return;
    }

    setIsLoading(true);
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
        setIsSaved(true);
        toast({ title: 'Recipe saved!', description: `${recipe.name} saved to your recipes.` });
      } else {
        toast({ title: 'Already saved', description: result.message });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save recipe.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={isSaved ? 'default' : 'outline'}
      onClick={handleSave}
      disabled={isLoading || isSaved}
      className="gap-1"
    >
      {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {isSaved ? 'Saved' : 'Save'}
    </Button>
  );
}

function RecipeShareButton({ recipe, isAuth, userId }: { recipe: Recipe; isAuth: boolean; userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const createShareMutation = useMutation(api.recipes.createRecipeShare);
  const { toast } = useToast();

  const handleCreateShare = async () => {
    if (!isAuth || !userId) {
      toast({ title: 'Sign in required', description: 'Please sign in to share recipes.' });
      setOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await createShareMutation({
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

      setShareId(result.shareId);
      toast({ title: 'Share link created!', description: 'Copy the link to share with others.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create share link.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareId) return;
    const link = `${window.location.origin}/shared-recipe?id=${shareId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copied!', description: 'Shareable link copied to clipboard.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy link.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" className="gap-1" asChild>
        <DialogTrigger>
          <Share2 className="h-4 w-4" />
          Share
        </DialogTrigger>
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{recipe.name}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {shareId ? (
            <>
              <p className="text-sm text-muted-foreground">Anyone with this link can view the recipe:</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/shared-recipe?id=${shareId}`}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleCopyLink}>
                  Copy
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={handleCreateShare} disabled={isLoading} className="w-full">
              {isLoading ? 'Creating...' : 'Create Share Link'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecipePrintButton({ recipe }: { recipe: Recipe }) {
  const handlePrint = () => {
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

  return (
    <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1">
      <Printer className="h-4 w-4" />
      Print
    </Button>
  );
}
