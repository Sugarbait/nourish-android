'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useToast } from '@/hooks/use-toast';

export default function DeleteAccountPage() {
  const { toast } = useToast();
  const deleteAccount = useAction(api.accountDeletion.deleteUserAccount);

  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const userId = typeof window !== 'undefined' ? localStorage.getItem('nourish_user_id') : null;

  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Not signed in</h1>
          <p className="text-muted-foreground mb-6">You must be signed in to delete your account.</p>
          <Button onClick={() => { window.location.href = window.location.origin + '/index.html'; }}>Back to App</Button>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      toast({ title: 'Confirmation failed', description: 'Type DELETE to confirm', variant: 'destructive' });
      return;
    }

    if (!password) {
      toast({ title: 'Password required', description: 'Enter your password to confirm deletion', variant: 'destructive' });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount({ userId, password });
      toast({ title: 'Account deleted', description: 'Your account and all data have been permanently deleted.' });
      localStorage.removeItem('nourish_user_id');
      localStorage.removeItem('nourish_user_email');
      localStorage.removeItem('nourishai-credits');
      window.location.href = window.location.origin + '/index.html';
    } catch (error: any) {
      toast({
        title: 'Deletion failed',
        description: error.message || 'Could not delete account',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-3xl font-bold mb-2">Delete Account</h1>
        <p className="text-muted-foreground mb-8">
          Permanently delete your Nourish account and all associated data.
        </p>

        <Alert className="border-destructive bg-destructive/10 mb-8">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle>This action cannot be undone</AlertTitle>
          <AlertDescription>
            Deleting your account will permanently remove:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your account and login credentials</li>
              <li>All meal logs and nutrition history</li>
              <li>All AI conversations and coaching data</li>
              <li>Saved recipes and preferences</li>
              <li>Water intake logs</li>
              <li>Subscription and credit information</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-6 bg-card border border-border rounded-lg p-6">
          <div>
            <label className="block text-sm font-medium mb-2">Enter your password</label>
            <Input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isDeleting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Type <strong>DELETE</strong> to confirm
            </label>
            <Input
              type="text"
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              disabled={isDeleting}
            />
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== 'DELETE' || !password}
            >
              {isDeleting ? 'Deleting...' : 'Delete My Account'}
            </Button>
          </div>
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            If you have any questions or concerns about data deletion, contact us at{' '}
            <a href="mailto:contactus@neoncell.ca" className="text-primary hover:underline">
              contactus@neoncell.ca
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
