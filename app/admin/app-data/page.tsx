'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, Users, Utensils, Droplets, CreditCard, MessageSquare,
  TrendingUp, UserCheck, ShieldOff, Crown, BarChart2, Trophy,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar,
} from 'recharts';

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 md:p-5 flex items-center gap-3">
        <div className={`rounded-full p-3 flex-shrink-0 ${color ?? 'bg-emerald-500/10 text-emerald-500'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight truncate">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function AppDataPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'overview' | 'users' | 'engagement'>('overview');
  const stats = useQuery(api.adminStats.getAppStats);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) router.push('/admin/signin');
    else setAuthed(true);
  }, [router]);

  if (authed === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <Button asChild variant="ghost" className="gap-1 mb-4">
            <Link href="/admin"><ArrowLeft className="w-4 h-4" /> Back</Link>
          </Button>
          <p className="text-muted-foreground">Loading app stats…</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart2 },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'engagement' as const, label: 'Engagement', icon: TrendingUp },
  ];

  const mealTypeBars = Object.entries(stats.mealTypeCounts)
    .map(([name, count]) => ({ name: name[0].toUpperCase() + name.slice(1), count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2 mb-2">
              <Link href="/admin"><ArrowLeft className="w-4 h-4" /> Back to Admin</Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold">
              App{' '}
              <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">
                Data
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time overview of Nourish usage</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-full w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                tab === t.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Users} label="Total Users" value={formatNumber(stats.totalUsers)} sub={`${stats.newUsers7d} new this week`} />
              <StatCard icon={Utensils} label="Meals Logged" value={formatNumber(stats.totalMeals)} sub={`${stats.meals7d} this week`} color="bg-orange-500/10 text-orange-500" />
              <StatCard icon={Droplets} label="Water Glasses" value={formatNumber(stats.totalWaterGlasses)} sub="all-time" color="bg-blue-500/10 text-blue-500" />
              <StatCard icon={Crown} label="Active Subs" value={formatNumber(stats.activeSubs)} sub={`${stats.monthlySubs} mo · ${stats.yearlySubs} yr`} color="bg-amber-500/10 text-amber-500" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={UserCheck} label="Verified" value={formatNumber(stats.verifiedUsers)} sub={`${Math.round((stats.verifiedUsers / Math.max(stats.totalUsers, 1)) * 100)}% of users`} color="bg-green-500/10 text-green-500" />
              <StatCard icon={ShieldOff} label="Banned" value={formatNumber(stats.bannedUsers)} color="bg-red-500/10 text-red-500" />
              <StatCard icon={CreditCard} label="Credits in Circulation" value={formatNumber(stats.totalCredits)} color="bg-purple-500/10 text-purple-500" />
              <StatCard icon={MessageSquare} label="AI Coach Messages" value={formatNumber(stats.totalAiMessages)} color="bg-indigo-500/10 text-indigo-500" />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Signups — Last 30 Days</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.signupTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'users' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Users} label="Total Users" value={formatNumber(stats.totalUsers)} />
              <StatCard icon={TrendingUp} label="New (7d)" value={formatNumber(stats.newUsers7d)} color="bg-blue-500/10 text-blue-500" />
              <StatCard icon={TrendingUp} label="New (30d)" value={formatNumber(stats.newUsers30d)} color="bg-purple-500/10 text-purple-500" />
              <StatCard icon={UserCheck} label="Active (7d)" value={formatNumber(stats.activeUsers7d)} sub="logged a meal" color="bg-emerald-500/10 text-emerald-500" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Trophy className="w-4 h-4 text-amber-500" /> Top Users by Meals Logged</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase border-b border-border/40">
                    <tr>
                      <th className="text-left py-2 px-4">Rank</th>
                      <th className="text-left py-2 px-4">Email</th>
                      <th className="text-right py-2 px-4">Meals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topUsers.length === 0 ? (
                      <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No data yet</td></tr>
                    ) : stats.topUsers.map((u, i) => (
                      <tr key={u.email} className="border-b border-border/30 last:border-0">
                        <td className="py-2 px-4 font-bold text-muted-foreground">#{i + 1}</td>
                        <td className="py-2 px-4 truncate max-w-[200px] md:max-w-none">{u.email}</td>
                        <td className="py-2 px-4 text-right font-semibold">{u.mealCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'engagement' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Utensils} label="Meals (7d)" value={formatNumber(stats.meals7d)} color="bg-orange-500/10 text-orange-500" />
              <StatCard icon={Utensils} label="Meals (30d)" value={formatNumber(stats.meals30d)} color="bg-orange-500/10 text-orange-500" />
              <StatCard icon={UserCheck} label="Active (7d)" value={formatNumber(stats.activeUsers7d)} color="bg-emerald-500/10 text-emerald-500" />
              <StatCard icon={UserCheck} label="Active (30d)" value={formatNumber(stats.activeUsers30d)} color="bg-emerald-500/10 text-emerald-500" />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Total Calories Tracked</CardTitle></CardHeader>
              <CardContent>
                <p className="text-4xl font-extrabold text-orange-400">{formatNumber(stats.totalCaloriesLogged)} kcal</p>
                <p className="text-sm text-muted-foreground mt-1">across all users, all time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Meals by Type</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mealTypeBars}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
