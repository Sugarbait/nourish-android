'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  LogOut, Trash2, AlertTriangle, Users, TrendingUp, Settings, BarChart2,
  Ban, ShieldCheck, X, Mail, Search, ChevronLeft, ChevronRight, UserCheck,
} from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 25;

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState('');

  const rawUsers = useQuery(api.users.adminListUsers);
  const rawSubs = useQuery(api.users.adminListSubscriptions);
  const rawCredits = useQuery(api.users.adminListCredits);

  // Join client-side
  const allUsers = rawUsers && rawSubs && rawCredits
    ? rawUsers.map((u) => {
        const sub = rawSubs.find((s) => s.userId === u._id) ?? null;
        const cred = rawCredits.find((c) => c.userId === u._id) ?? null;
        return { ...u, subscription: sub, credits: cred };
      })
    : undefined;

  const banUser = useMutation(api.users.banUser);
  const deleteUser = useMutation(api.users.deleteUser);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmBan, setConfirmBan] = useState<{ id: Id<'users'>; email: string; banned: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: Id<'users'>; email: string } | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin/signin');
    } else {
      setIsAuthenticated(true);
      setAdminEmail(token);
    }
  }, [router]);

  const handleSignOut = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    localStorage.removeItem('admin_token');
    router.push('/');
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Stats
  const totalUsers = allUsers?.length ?? 0;
  const activeSubscribers = allUsers?.filter((u) => u.subscription?.active).length ?? 0;
  const bannedCount = allUsers?.filter((u) => u.banned).length ?? 0;
  const verifiedCount = allUsers?.filter((u) => u.emailVerified).length ?? 0;

  // Filtered + paginated users
  const filtered = (allUsers ?? []).filter((u) => {
    const q = searchQuery.toLowerCase();
    return !q || u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background p-3 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Image
                src="/logo-icon.png"
                alt="Nourish Logo"
                width={40}
                height={40}
                className="w-9 h-9 md:w-12 md:h-12 object-contain"
              />
              <h1 className="text-xl md:text-3xl font-bold">Nourish Admin</h1>
            </div>
            <p className="text-muted-foreground text-xs md:text-sm truncate">Signed in as <span className="font-medium text-foreground">{adminEmail}</span></p>
          </div>
          <div className="grid grid-cols-4 sm:flex sm:items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/admin/app-data"><BarChart2 className="w-4 h-4" /><span className="hidden sm:inline">App Data</span></Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/admin/broadcast"><Mail className="w-4 h-4" /><span className="hidden sm:inline">Broadcast</span></Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/admin/settings"><Settings className="w-4 h-4" /><span className="hidden sm:inline">Settings</span></Link>
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="sm" className="gap-1.5">
              <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalUsers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" /> Subscribers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-500">{activeSubscribers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-500" /> Verified
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-500">{verifiedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-500" /> Banned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-500">{bannedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* User Management */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" /> User Management
              </CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {paginated.map((user) => (
                <div key={user._id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{user.email}</p>
                      {user.name && <p className="text-xs text-muted-foreground">{user.name}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(user._creationTime).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={user.banned ? "text-green-600 hover:text-green-700 h-8 w-8" : "text-amber-600 hover:text-amber-700 h-8 w-8"}
                        onClick={() => setConfirmBan({ id: user._id as Id<'users'>, email: user.email, banned: user.banned })}
                      >
                        {user.banned ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 h-8 w-8"
                        onClick={() => setConfirmDelete({ id: user._id as Id<'users'>, email: user.email })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {user.banned ? (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Ban className="w-3 h-3" /> Banned
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Active
                      </span>
                    )}
                    {user.subscription?.active ? (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full font-medium capitalize">
                        {user.subscription.plan ?? 'subscribed'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Free</span>
                    )}
                    {user.authProvider && <span className="text-xs text-muted-foreground capitalize">{user.authProvider}</span>}
                  </div>
                </div>
              ))}
              {paginated.length === 0 && (
                <p className="py-8 text-center text-muted-foreground text-sm">No users found.</p>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">User</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Joined</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden lg:table-cell">Plan</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden lg:table-cell">Credits</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden lg:table-cell">Meals</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((user) => (
                    <tr key={user._id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{user.email}</p>
                          {user.name && <p className="text-xs text-muted-foreground">{user.name}</p>}
                          {user.authProvider && <p className="text-xs text-muted-foreground capitalize">{user.authProvider}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        {new Date(user._creationTime).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 hidden lg:table-cell">
                        {user.subscription?.active ? (
                          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full font-medium capitalize">
                            {user.subscription.plan ?? 'active'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Free</span>
                        )}
                      </td>
                      <td className="py-3 px-2 hidden lg:table-cell text-muted-foreground text-xs">
                        {user.credits ? (
                          <span>{user.credits.credits} + {user.credits.purchasedCredits} pack</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-2 hidden lg:table-cell text-muted-foreground">—</td>
                      <td className="py-3 px-2">
                        {user.banned ? (
                          <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit">
                            <Ban className="w-3 h-3" /> Banned
                          </span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit">
                            <ShieldCheck className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={user.banned ? "text-green-600 hover:text-green-700" : "text-amber-600 hover:text-amber-700"}
                            onClick={() => setConfirmBan({ id: user._id as Id<'users'>, email: user.email, banned: user.banned })}
                            title={user.banned ? 'Unban user' : 'Ban user'}
                          >
                            {user.banned ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setConfirmDelete({ id: user._id as Id<'users'>, email: user.email })}
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="icon" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ban/Unban Modal */}
      {confirmBan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <button onClick={() => setConfirmBan(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-lg">{confirmBan.banned ? 'Unban User' : 'Ban User'}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {confirmBan.banned
                  ? `Restore access for ${confirmBan.email}?`
                  : `Block login for ${confirmBan.email}? They will not be able to sign in.`}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmBan(null)} disabled={isWorking}>Cancel</Button>
              <Button
                className={`flex-1 ${confirmBan.banned ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                disabled={isWorking}
                onClick={async () => {
                  setIsWorking(true);
                  await banUser({ userId: confirmBan.id, banned: !confirmBan.banned });
                  setConfirmBan(null);
                  setIsWorking(false);
                }}
              >
                {isWorking ? 'Saving...' : confirmBan.banned ? 'Unban' : 'Ban User'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <button onClick={() => setConfirmDelete(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Delete User</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete <strong>{confirmDelete.email}</strong> and all their data? This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)} disabled={isWorking}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={isWorking}
                onClick={async () => {
                  setIsWorking(true);
                  await deleteUser({ userId: confirmDelete.id });
                  setConfirmDelete(null);
                  setIsWorking(false);
                }}
              >
                {isWorking ? 'Deleting...' : 'Delete Forever'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
