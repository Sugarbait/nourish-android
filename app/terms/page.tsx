import { Leaf, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
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
          <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 23, 2026</p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Nourish ("the Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you do not agree to these Terms, please do not use the Service. These Terms apply to
              all visitors, users, and others who access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">2. Description of Service</h2>
            <p>
              Nourish is an AI-powered nutrition tracking application that allows users to:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Scan and identify food items using AI image recognition.</li>
              <li>Track daily calories, protein, carbs, and fat.</li>
              <li>Receive personalised nutrition coaching via AI.</li>
              <li>Monitor water intake and daily health goals.</li>
              <li>Purchase credits and subscription plans for enhanced access.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">3. User Accounts</h2>
            <p>
              To use certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain the security of your password and account.</li>
              <li>Notify us immediately of any unauthorised use of your account.</li>
              <li>Accept responsibility for all activities under your account.</li>
            </ul>
            <p className="mt-2">
              You must be at least 13 years of age to create an account and use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">4. Credits and Payments</h2>
            <p>
              Nourish operates on a credit-based system:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-foreground">Free tier:</strong> All users receive 1 free meal scan and 1 free AI message per day.</li>
              <li><strong className="text-foreground">Credit packs:</strong> One-time purchases of credits that never expire.</li>
              <li><strong className="text-foreground">Monthly subscription ($5.99/mo):</strong> 300 credits per month that reset at the start of each billing cycle. Top-up credits purchased separately do not reset.</li>
            </ul>
            <p className="mt-2">
              All purchases are final. We do not offer refunds except where required by applicable law. Credits
              have no cash value and cannot be transferred between accounts.
            </p>
            <p className="mt-2">
              Subscription billing occurs monthly. You may cancel your subscription at any time; cancellation
              takes effect at the end of the current billing period.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Violate any applicable laws or regulations.</li>
              <li>Upload content that is illegal, harmful, or offensive.</li>
              <li>Attempt to gain unauthorised access to our systems.</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
              <li>Use automated tools to scrape or bulk-access the Service.</li>
              <li>Impersonate any person or entity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">6. Health Disclaimer</h2>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-300/80">
              <p className="font-semibold text-amber-300 mb-1">Important: Not Medical Advice</p>
              <p>
                Nourish is a general wellness tool and is <strong>not a substitute for professional medical advice,
                diagnosis, or treatment</strong>. Nutritional information provided by the AI may not be perfectly
                accurate. Always consult a qualified healthcare provider or registered dietitian before making
                significant changes to your diet, especially if you have a medical condition.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">7. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by Nourish and are
              protected by international copyright, trademark, and other intellectual property laws.
            </p>
            <p className="mt-2">
              You retain ownership of the content you submit (such as meal photos). By submitting content, you
              grant us a limited, non-exclusive licence to process and display that content solely for the purpose
              of providing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Nourish shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill,
              arising from your use of or inability to use the Service.
            </p>
            <p className="mt-2">
              Our total liability to you for any claims arising from these Terms or the Service shall not exceed
              the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at our sole discretion, without notice,
              if you breach these Terms or engage in behaviour that is harmful to other users, us, or third parties.
            </p>
            <p className="mt-2">
              You may delete your account at any time through the app settings. Upon termination, your right to
              use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Material changes will be communicated by
              updating the date at the top of this page and, where appropriate, by email notification. Your
              continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">11. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws, without regard
              to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">12. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <div className="mt-2 rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p><strong className="text-foreground">Nourish</strong></p>
              <p>Email: <a href="mailto:contactus@neoncell.ca" className="text-primary hover:underline">contactus@neoncell.ca</a></p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-4 mt-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Nourish. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
