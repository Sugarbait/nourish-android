'use client';

import { useEffect, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { clearAuthStorage } from '@/lib/auth-storage';

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const { toast } = useToast();
  const deleteAccount = useAction(api.accountDeletion.deleteUserAccount);

  const userId = typeof window !== 'undefined' ? localStorage.getItem('nourish_user_id') : null;
  const authInfo = useQuery(
    api.accountDeletionInternal.requiresPasswordForDeletion,
    userId ? { userId } : 'skip',
  );
  const requiresPassword = authInfo?.requiresPassword ?? true; // default to true while loading

  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset fields when the modal opens / closes.
  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmText('');
      setIsDeleting(false);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!userId) {
      toast({ title: 'Not signed in', description: 'You must be signed in to delete your account.', variant: 'destructive' });
      return;
    }
    if (confirmText !== 'DELETE') {
      toast({ title: 'Confirmation failed', description: 'Type DELETE to confirm', variant: 'destructive' });
      return;
    }
    if (requiresPassword && !password) {
      toast({ title: 'Password required', description: 'Enter your password to confirm deletion', variant: 'destructive' });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount({ userId, password: password || '' });
      // Close the modal so the toast is visible.
      onOpenChange(false);
      toast({
        title: 'Account deleted',
        description: 'Your account and all data have been permanently deleted.',
        duration: 4000,
      });
      // Wait so the toast actually renders before we hard-navigate away.
      setTimeout(() => {
        clearAuthStorage();
        window.location.href = window.location.origin + '/index.html';
      }, 2500);
    } catch (error: any) {
      toast({ title: 'Deletion failed', description: error?.message || 'Could not delete account', variant: 'destructive' });
      setIsDeleting(false);
    }
  };

  const canDelete = confirmText === 'DELETE' && (!requiresPassword || password.length > 0) && !isDeleting;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!isDeleting) onOpenChange(o); }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            Permanently delete your Nourish account and all associated data.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle>This action cannot be undone</AlertTitle>
          <AlertDescription>
            Deleting your account will permanently remove:
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>Your account and login credentials</li>
              <li>All meal logs and nutrition history</li>
              <li>All AI conversations and coaching data</li>
              <li>Saved recipes and preferences</li>
              <li>Water intake logs</li>
              <li>Subscription and credit information</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {requiresPassword && (
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
          )}
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
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {isDeleting ? 'Deleting...' : 'Delete My Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
