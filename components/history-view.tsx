'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  BarChart2,
  ArrowLeft,
  Droplets,
  Flame,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Calendar } from './ui/calendar';
import { Button } from './ui/button';

type DailyGoals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
};

type FoodItem = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Meal = {
  id: string;
  name: string;
  items: FoodItem[];
  timestamp: number;
};

type DailyData = {
  meals: Meal[];
  water: number;
};

type HistoryDayData = {
  date: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  mealCount: number;
};

interface HistoryViewProps {
  userId: string | null;
  isGuest: boolean;
  historyRange: 7 | 15 | 30 | 90;
  setHistoryRange: (r: 7 | 15 | 30 | 90) => void;
  isCustomRange: boolean;
  setIsCustomRange: (v: boolean) => void;
  customRangeStart: Date | undefined;
  setCustomRangeStart: (d: Date | undefined) => void;
  customRangeEnd: Date | undefined;
  setCustomRangeEnd: (d: Date | undefined) => void;
  historyStartDate: string;
  historyEndDate: string;
  historyMeals: any[] | undefined;
  historyWater: any[] | undefined;
  localHistory: Record<string, DailyData>;
  goals: DailyGoals;
  historyDrillDate: string | null;
  setHistoryDrillDate: (d: string | null) => void;
}

function WeekAccordions({
  dailyData,
  goals,
  onSelectDay,
}: {
  dailyData: HistoryDayData[];
  goals: DailyGoals;
  onSelectDay: (date: string) => void;
}) {
  // Group days into weeks (Mon–Sun)
  const weeks = useMemo(() => {
    const sorted = [...dailyData].sort((a, b) => b.date.localeCompare(a.date)); // newest first
    const groups: HistoryDayData[][] = [];
    let current: HistoryDayData[] = [];
    let currentWeekMonday = '';
    for (const day of sorted) {
      const d = new Date(day.date + 'T00:00:00');
      const dow = d.getDay(); // 0=Sun
      const diff = (dow === 0 ? -6 : 1 - dow);
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      const mondayStr = format(monday, 'yyyy-MM-dd');
      if (mondayStr !== currentWeekMonday) {
        if (current.length) groups.push(current);
        current = [day];
        currentWeekMonday = mondayStr;
      } else {
        current.push(day);
      }
    }
    if (current.length) groups.push(current);
    return groups;
  }, [dailyData]);

  const [openWeeks, setOpenWeeks] = useState<Set<number>>(() => new Set([0]));
  const toggle = (i: number) => setOpenWeeks(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const goalCals = Math.max(goals.calories, 1);

  return (
    <div>
      <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Daily Breakdown</h3>
      <div className="space-y-2">
        {weeks.map((week, wi) => {
          const isOpen = openWeeks.has(wi);
          const totalCals = week.reduce((s, d) => s + d.calories, 0);
          const totalProtein = week.reduce((s, d) => s + d.protein, 0);
          const activeDays = week.filter(d => d.calories > 0).length;
          const newest = week[0];
          const oldest = week[week.length - 1];
          const weekLabel = newest.date === oldest.date
            ? format(new Date(newest.date + 'T00:00:00'), 'MMM d')
            : `${format(new Date(oldest.date + 'T00:00:00'), 'MMM d')} – ${format(new Date(newest.date + 'T00:00:00'), 'MMM d')}`;

          return (
            <Card key={wi} className="overflow-hidden">
              {/* Week header row — always visible */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                onClick={() => toggle(wi)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-sm">{weekLabel}</p>
                    <p className="text-xs text-muted-foreground">{activeDays} active day{activeDays !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <p className="font-black text-orange-400 text-base leading-none">{totalCals.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">kcal total</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="font-bold text-blue-400 text-sm leading-none">{Math.round(totalProtein)}g</p>
                    <p className="text-[10px] text-muted-foreground">protein</p>
                  </div>
                </div>
              </button>

              {/* Expanded day rows */}
              {isOpen && (
                <div className="border-t border-border/50">
                  {week.map((day) => {
                    const pct = Math.min((day.calories / goalCals) * 100, 100);
                    return (
                      <button
                        key={day.date}
                        onClick={() => onSelectDay(day.date)}
                        className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40 active:bg-muted/60 transition-colors border-b border-border/30 last:border-0 ${day.calories === 0 ? 'opacity-40' : ''}`}
                      >
                        <div className="w-14 text-left shrink-0">
                          <p className="text-xs font-semibold">{format(new Date(day.date + 'T00:00:00'), 'EEE')}</p>
                          <p className="text-[10px] text-muted-foreground">{format(new Date(day.date + 'T00:00:00'), 'MMM d')}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{day.mealCount} meal{day.mealCount !== 1 ? 's' : ''} · {day.water}💧</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold text-sm">{day.calories > 0 ? day.calories.toLocaleString() : '—'}</p>
                          <p className="text-[10px] text-muted-foreground">kcal</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function HistoryView({
  userId,
  isGuest,
  historyRange,
  setHistoryRange,
  isCustomRange,
  setIsCustomRange,
  customRangeStart,
  setCustomRangeStart,
  customRangeEnd,
  setCustomRangeEnd,
  historyStartDate,
  historyEndDate,
  historyMeals,
  historyWater,
  localHistory,
  goals,
  historyDrillDate,
  setHistoryDrillDate,
}: HistoryViewProps) {
  const [showCustom, setShowCustom] = useState(false);

  const datesInRange = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(historyStartDate + 'T00:00:00');
    const end = new Date(historyEndDate + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(format(d, 'yyyy-MM-dd'));
    }
    return dates;
  }, [historyStartDate, historyEndDate]);

  const dailyData: HistoryDayData[] = useMemo(() => {
    return datesInRange.map((date) => {
      let calories = 0, protein = 0, carbs = 0, fat = 0, water = 0, mealCount = 0;
      if (!isGuest && historyMeals) {
        const dayMeals = historyMeals.filter((m: any) => m.date === date);
        calories = dayMeals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
        protein = dayMeals.reduce((s: number, m: any) => s + (m.protein || 0), 0);
        carbs = dayMeals.reduce((s: number, m: any) => s + (m.carbs || 0), 0);
        fat = dayMeals.reduce((s: number, m: any) => s + (m.fat || 0), 0);
        mealCount = dayMeals.length;
        water = historyWater?.find((w: any) => w.date === date)?.glasses ?? 0;
      } else {
        const day = localHistory[date];
        if (day) {
          day.meals.forEach((meal) => {
            meal.items.forEach((item) => {
              calories += item.calories || 0;
              protein += item.protein || 0;
              carbs += item.carbs || 0;
              fat += item.fat || 0;
            });
            mealCount++;
          });
          water = day.water || 0;
        }
      }
      const dateObj = new Date(date + 'T00:00:00');
      return {
        date,
        label: format(dateObj, datesInRange.length <= 15 ? 'MMM d' : 'M/d'),
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        water,
        mealCount,
      };
    });
  }, [datesInRange, isGuest, historyMeals, historyWater, localHistory]);

  const activeDays = dailyData.filter((d) => d.calories > 0 || d.water > 0);
  const count = activeDays.length || 1;
  const avgCalories = Math.round(activeDays.reduce((s, d) => s + d.calories, 0) / count);
  const avgProtein = Math.round(activeDays.reduce((s, d) => s + d.protein, 0) / count);
  const avgCarbs = Math.round(activeDays.reduce((s, d) => s + d.carbs, 0) / count);
  const avgFat = Math.round(activeDays.reduce((s, d) => s + d.fat, 0) / count);
  const avgWater = +(activeDays.reduce((s, d) => s + d.water, 0) / count).toFixed(1);
  const totalMeals = dailyData.reduce((s, d) => s + d.mealCount, 0);

  const drillMeals = useMemo(() => {
    if (!historyDrillDate) return [];
    if (!isGuest && historyMeals) {
      return historyMeals.filter((m: any) => m.date === historyDrillDate);
    }
    return localHistory[historyDrillDate]?.meals || [];
  }, [historyDrillDate, isGuest, historyMeals, localHistory]);

  const isLoading = !isGuest && userId && (historyMeals === undefined || historyWater === undefined);

  const RANGES: { label: string; value: 7 | 15 | 30 | 90 }[] = [
    { label: '7D', value: 7 },
    { label: '15D', value: 15 },
    { label: '30D', value: 30 },
    { label: '90D', value: 90 },
  ];

  return (
    <div className="pb-24 min-h-[calc(100dvh-56px)]">
      {/* Range selector bar */}
      <div className="sticky top-14 z-10 bg-background/90 backdrop-blur-lg border-b border-border/40 px-4 py-2.5">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setHistoryRange(r.value)}
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !isCustomRange && historyRange === r.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isCustomRange
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
            onClick={() => setShowCustom(true)}
          >
            Custom
          </button>

          {/* Full-screen custom range picker overlay */}
          {showCustom && (
            <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setShowCustom(false)}>
              <div className="flex-1 bg-black/50" />
              <div
                className="bg-background rounded-t-2xl p-5 space-y-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Select Date Range</p>
                  <button onClick={() => setShowCustom(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
                </div>
                <div className="flex justify-center">
                  <Calendar
                    mode="range"
                    selected={{ from: customRangeStart, to: customRangeEnd }}
                    onSelect={(range) => {
                      setCustomRangeStart(range?.from);
                      setCustomRangeEnd(range?.to);
                    }}
                    disabled={(d) => d > new Date()}
                    numberOfMonths={1}
                    initialFocus
                    className="rounded-lg border"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>From: <strong>{customRangeStart ? format(customRangeStart, 'MMM d, yyyy') : '—'}</strong></span>
                  <span>To: <strong>{customRangeEnd ? format(customRangeEnd, 'MMM d, yyyy') : '—'}</strong></span>
                </div>
                <Button
                  className="w-full"
                  disabled={!customRangeStart || !customRangeEnd}
                  onClick={() => { setIsCustomRange(true); setShowCustom(false); }}
                >
                  Apply Range
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 max-w-2xl">
        {/* Drill-in view */}
        {historyDrillDate && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHistoryDrillDate(null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <h2 className="font-bold text-lg">
                {format(new Date(historyDrillDate + 'T00:00:00'), 'EEEE, MMMM d')}
              </h2>
            </div>

            {/* Day summary stats */}
            {(() => {
              const dayData = dailyData.find((d) => d.date === historyDrillDate);
              return dayData ? (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Calories', value: dayData.calories, unit: 'kcal', color: 'text-orange-400' },
                    { label: 'Protein', value: dayData.protein, unit: 'g', color: 'text-blue-400' },
                    { label: 'Carbs', value: dayData.carbs, unit: 'g', color: 'text-yellow-400' },
                    { label: 'Fat', value: dayData.fat, unit: 'g', color: 'text-red-400' },
                  ].map((stat) => (
                    <Card key={stat.label} className="text-center">
                      <CardContent className="pt-3 pb-3 px-2">
                        <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.unit}</p>
                        <p className="text-[10px] font-medium mt-0.5">{stat.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Meals list */}
            {drillMeals.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  No meals logged this day.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {drillMeals.map((meal: any, idx: number) => {
                  const isConvexMeal = !isGuest && !!meal._id;
                  const name = meal.name || meal.mealType || 'Meal';
                  const items = meal.items || [];
                  const calories = isConvexMeal ? (meal.calories || 0) : items.reduce((s: number, i: any) => s + i.calories, 0);
                  const protein = isConvexMeal ? (meal.protein || 0) : items.reduce((s: number, i: any) => s + i.protein, 0);
                  const carbs = isConvexMeal ? (meal.carbs || 0) : items.reduce((s: number, i: any) => s + i.carbs, 0);
                  const fat = isConvexMeal ? (meal.fat || 0) : items.reduce((s: number, i: any) => s + i.fat, 0);
                  const imageUrl = meal.imageUrl as string | undefined;
                  return (
                    <Card key={idx}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3 mb-3">
                          {imageUrl && (
                            <div className="rounded-2xl overflow-hidden flex-shrink-0 w-24 aspect-square">
                              <img
                                src={imageUrl}
                                alt={name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
                            <div className="min-w-0">
                              <p className="font-semibold capitalize truncate">{name}</p>
                              <p className="text-xs text-muted-foreground">
                                {items.length} item{items.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-orange-400">{Math.round(calories)} kcal</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-blue-500/10 rounded-lg py-1.5">
                            <p className="text-sm font-bold text-blue-400">{Math.round(protein)}g</p>
                            <p className="text-[10px] text-muted-foreground">Protein</p>
                          </div>
                          <div className="bg-yellow-500/10 rounded-lg py-1.5">
                            <p className="text-sm font-bold text-yellow-400">{Math.round(carbs)}g</p>
                            <p className="text-[10px] text-muted-foreground">Carbs</p>
                          </div>
                          <div className="bg-red-500/10 rounded-lg py-1.5">
                            <p className="text-sm font-bold text-red-400">{Math.round(fat)}g</p>
                            <p className="text-[10px] text-muted-foreground">Fat</p>
                          </div>
                        </div>
                        {items.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {items.map((item: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs text-muted-foreground py-0.5 border-t border-border/30"
                              >
                                <span className="truncate max-w-[60%]">{item.name}</span>
                                <span className="font-medium">{item.calories} kcal</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Overview */}
        {!historyDrillDate && (
          <div className="space-y-5">
            {isLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
                <div className="h-48 rounded-xl bg-muted animate-pulse" />
              </div>
            ) : (
              <>
                {/* Period label */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-lg">
                      {isCustomRange
                        ? `${format(new Date(historyStartDate + 'T00:00:00'), 'MMM d')} – ${format(new Date(historyEndDate + 'T00:00:00'), 'MMM d, yyyy')}`
                        : `Last ${historyRange} Days`}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {activeDays.length} active day{activeDays.length !== 1 ? 's' : ''} · {totalMeals} meals logged
                    </p>
                  </div>
                </div>

                {/* Avg stat cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Avg Calories', value: avgCalories, unit: 'kcal/day', color: 'from-orange-500/20 to-orange-400/5', text: 'text-orange-400', goal: goals.calories },
                    { label: 'Avg Protein', value: avgProtein, unit: 'g/day', color: 'from-blue-500/20 to-blue-400/5', text: 'text-blue-400', goal: goals.protein },
                    { label: 'Avg Carbs', value: avgCarbs, unit: 'g/day', color: 'from-yellow-500/20 to-yellow-400/5', text: 'text-yellow-400', goal: goals.carbs },
                    { label: 'Avg Fat', value: avgFat, unit: 'g/day', color: 'from-red-500/20 to-red-400/5', text: 'text-red-400', goal: goals.fat },
                  ].map((stat) => (
                    <Card key={stat.label} className={`bg-gradient-to-br ${stat.color} border-border/40`}>
                      <CardContent className="pt-4 pb-4 px-4">
                        <p className={`text-3xl font-black ${stat.text} leading-none`}>{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{stat.unit}</p>
                        <p className="text-xs font-semibold mt-2">{stat.label}</p>
                        {stat.goal > 0 && (
                          <div className="mt-2">
                            <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min((stat.value / stat.goal) * 100, 100)}%`,
                                  backgroundColor: 'currentColor',
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {Math.round((stat.value / stat.goal) * 100)}% of goal
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Water avg card */}
                <Card className="bg-gradient-to-br from-sky-500/15 to-sky-400/5 border-border/40">
                  <CardContent className="pt-3 pb-3 px-4 flex items-center gap-4">
                    <Droplets className="h-8 w-8 text-sky-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-2xl font-black text-sky-400">
                        {avgWater} <span className="text-sm font-normal text-muted-foreground">glasses/day</span>
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Avg Hydration · goal: {goals.water} glasses
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-sky-400">
                        {Math.round((avgWater / Math.max(goals.water, 1)) * 100)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">of goal</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Calorie trend line chart */}
                {activeDays.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-400" />
                        Calorie Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.floor(dailyData.length / 6)} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                            labelStyle={{ color: '#aaa' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(val: number) => [`${val} kcal`, 'Calories']}
                          />
                          <ReferenceLine
                            y={goals.calories}
                            stroke="hsl(var(--primary))"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{ value: 'Goal', position: 'right', fontSize: 10 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="calories"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={dailyData.length <= 15}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Macros trend line chart */}
                {activeDays.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Macros Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.floor(dailyData.length / 6)} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                            labelStyle={{ color: '#aaa' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(val: number, name: string) => [`${val}g`, name]}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="protein" name="Protein" stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                          <Line type="monotone" dataKey="carbs" name="Carbs" stroke="#facc15" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                          <Line type="monotone" dataKey="fat" name="Fat" stroke="#f87171" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Week accordions — tap week to expand, tap day to drill in */}
                <WeekAccordions
                  dailyData={dailyData}
                  goals={goals}
                  onSelectDay={setHistoryDrillDate}
                />

                {activeDays.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <BarChart2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="font-semibold text-muted-foreground">No data for this period</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start logging meals to see your history here
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
