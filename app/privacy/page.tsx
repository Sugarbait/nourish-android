import { Leaf, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="Nourish" className="h-8 w-auto" />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 23, 2026</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">1. Introduction</h2>
            <p>
              Welcome to Nourish ("we", "us", or "our"). We are committed to protecting your personal information
              and your right to privacy. This Privacy Policy explains how we collect, use, and safeguard your
              information when you use our application and services.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">2. Information We Collect</h2>
            <p>We collect information you provide directly to us, including:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-foreground">Account information:</strong> email address, name, and password (stored as a secure hash).</li>
              <li><strong className="text-foreground">Meal data:</strong> photos you upload for food recognition, meal names, nutritional values, and meal types.</li>
              <li><strong className="text-foreground">Health goals:</strong> calorie targets, nutrition targets, dietary restrictions you enter.</li>
              <li><strong className="text-foreground">Water intake logs:</strong> daily water consumption data.</li>
              <li><strong className="text-foreground">AI coach conversations:</strong> messages you send to and receive from the AI nutrition coach.</li>
              <li><strong className="text-foreground">Usage data:</strong> credit usage, subscription status, and feature interactions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide, operate, and maintain our services.</li>
              <li>Process meal photos using Google's Gemini AI API to identify food and estimate nutrition.</li>
              <li>Generate personalised responses from the AI nutrition coach.</li>
              <li>Track your nutrition goals and progress over time.</li>
              <li>Manage your account, credits, and subscription.</li>
              <li>Send important service-related communications.</li>
              <li>Improve and develop our services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">4. Third-Party Services</h2>
            <p>We use the following third-party services that may process your data:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-foreground">Convex:</strong> our real-time database provider, used to store your account and app data securely. See <a href="https://www.convex.dev/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Convex's Privacy Policy</a>.</li>
              <li><strong className="text-foreground">Google Gemini AI:</strong> used to analyse meal photos and power the AI coach. Meal images are sent to Google's API for processing. See <a href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.</li>
            </ul>
            <p className="mt-2">
              Meal images you submit are sent to Google's Gemini API for processing. We do not store the raw images
              on our servers — only the extracted nutritional data returned by the API.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">5. Data Storage and Security</h2>
            <p>
              Your data is stored securely on Convex's infrastructure. We use industry-standard security practices
              including hashed passwords and encrypted data transmission (HTTPS). However, no method of internet
              transmission is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate personal data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Object to processing of your personal data.</li>
              <li>Withdraw consent where processing is based on consent.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:contactus@neoncell.ca" className="text-primary hover:underline">contactus@neoncell.ca</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">7. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide services.
              You may request deletion of your account and data at any time. Upon deletion, your data will be
              permanently removed from our systems within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">8. Children's Privacy</h2>
            <p>
              Nourish is not directed to children under the age of 13. We do not knowingly collect personal
              information from children under 13. If you believe we have inadvertently collected such information,
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by
              updating the date at the top of this page and, where appropriate, by sending an email notification.
              Your continued use of Nourish after any changes constitutes your acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">10. Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy, please contact us:
            </p>
            <div className="mt-2 rounded-xl border border-white/5 bg-white/[0.03] p-4 text-sm">
              <p><strong className="text-foreground">Nourish</strong></p>
              <p>Email: <a href="mailto:contactus@neoncell.ca" className="text-primary hover:underline">contactus@neoncell.ca</a></p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-4 mt-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Nourish. All rights reserved.</span>
          <a href="https://www.neoncell.ca" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">www.neoncell.ca</a>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
