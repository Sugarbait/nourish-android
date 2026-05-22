'use client';

import { useState, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { goTo } from '@/lib/staticNav';

export default function BroadcastEmailPage() {
  const sendBroadcastEmail = useAction(api.emails.sendBroadcastEmail);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState('');

  const [subject, setSubject] = useState('');
  const [headline, setHeadline] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) goTo('/admin/signin');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !headline.trim() || !bodyText.trim()) {
      setError('Subject, Headline, and Message Body are required.');
      return;
    }
    if ((ctaText.trim() && !ctaUrl.trim()) || (!ctaText.trim() && ctaUrl.trim())) {
      setError('Both CTA Text and CTA Link must be provided if you want a button.');
      return;
    }
    setError('');
    setResult(null);
    setIsLoading(true);
    try {
      const response = await sendBroadcastEmail({
        subject: subject.trim(),
        headline: headline.trim(),
        bodyText: bodyText.trim(),
        ctaText: ctaText.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
      });
      setResult(response);
      setSubject('');
      setHeadline('');
      setBodyText('');
      setCtaText('');
      setCtaUrl('');
    } catch {
      setError('An error occurred while sending the broadcast email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Button onClick={() => goTo('/admin')} variant="ghost" size="icon" className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Broadcast Email</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Send an email to all Nourish users. Use this for announcements, feature updates, or promotions.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/50 p-4 border border-red-200 dark:border-red-900 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}
          {result && (
            <div className="rounded-md bg-green-50 dark:bg-green-950/50 p-4 border border-green-200 dark:border-green-900 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Broadcast Complete</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">Successfully sent to {result.sent} user(s).</p>
                {result.failed > 0 && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{result.failed} email(s) failed.</p>}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input id="subject" className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. New feature: AI Coach improvements" required />
              <p className="mt-1 text-xs text-muted-foreground">What users see in their inbox before opening.</p>
            </div>

            <div className="pt-4 border-t">
              <Label htmlFor="headline">Email Headline</Label>
              <Input id="headline" className="mt-1" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Big update to Nourish!" required />
              <p className="mt-1 text-xs text-muted-foreground">The bold heading at the top of the email.</p>
            </div>

            <div>
              <Label htmlFor="bodyText">Message Body</Label>
              <Textarea
                id="bodyText"
                rows={6}
                className="mt-1"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Write your email content here. Separate paragraphs with a blank line."
                required
              />
            </div>

            <div className="pt-4 border-t grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ctaText">Optional Button Text</Label>
                <Input id="ctaText" className="mt-1" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="e.g. Check it out" />
              </div>
              <div>
                <Label htmlFor="ctaUrl">Optional Button Link</Label>
                <Input id="ctaUrl" type="url" className="mt-1" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://nourishai.com/..." />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <Button type="button" variant="outline" onClick={() => goTo('/admin')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 px-8">
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Send Broadcast</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
