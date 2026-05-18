'use client';

import { Leaf, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  const goHome = (e: React.MouseEvent) => { e.preventDefault(); window.location.href = window.location.origin + '/index.html'; };
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/index.html" onClick={goHome} className="flex items-center">
            <img src="/logo.png" alt="Nourish" className="h-8 w-auto" />
          </a>
          <a href="/index.html" onClick={goHome} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </a>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: May 18, 2026</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">

          {/* ──────────────────────────────────────────────────────────────
              Plain-English summary — sits above the formal sections so any
              user can scan it in 30 seconds and know what we do and don't do.
              ────────────────────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
            <h2 className="text-base font-bold text-foreground mb-1">Privacy at a glance</h2>
            <p className="text-sm">
              Here's the short version, in plain English. The full policy below has the legal detail.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-foreground font-semibold text-sm">What we store</p>
                <p className="text-sm">
                  Your account (email, name, sign-in info), your profile (age, weight, height, goals),
                  the meals you log along with their photos, your water log, your subscription and credit
                  balance, and your chats with the AI coach.
                </p>
              </div>

              <div>
                <p className="text-foreground font-semibold text-sm">What we do NOT collect</p>
                <p className="text-sm">
                  Your photo gallery, your contacts, your location, your microphone, your messages, or
                  anything from other apps. When you scan a meal, the camera captures only that one shot.
                  When you change your avatar, the system file picker shows up — we only receive the file
                  you actually pick.
                </p>
              </div>

              <div>
                <p className="text-foreground font-semibold text-sm">What gets deleted automatically</p>
                <p className="text-sm">
                  AI coach chats older than 90 days, contact-form submissions older than 1 year, and
                  unused password-reset / email-verification codes once they expire. You can also delete
                  your entire account at any time from inside the app — when you do, all your data is
                  removed from our servers immediately.
                </p>
              </div>

              <div>
                <p className="text-foreground font-semibold text-sm">Who else sees your data</p>
                <p className="text-sm">
                  Meal photos are sent to Google's Gemini AI for food recognition (Google does not retain
                  them after the response). Payments go through Google Play and Stripe — we never see your
                  card details. Account data is hosted on Convex (running on Google Cloud).
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">1. Introduction</h2>
            <p>
              Welcome to Nourish ("we", "us", or "our"). We are committed to protecting your personal information
              and your right to privacy. This Privacy Policy explains what information we collect, how we use it,
              who we share it with, how long we keep it, and the rights you have over it. It applies to the Nourish
              mobile app and any web services we operate under the same brand.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">2. Information We Collect</h2>
            <p>We collect only the information needed for the app's core features to work. Specifically:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-foreground">Account information:</strong> your email address, your name, and either a one-way password hash or an OAuth identifier from Google or Microsoft if you sign in that way. We also keep an email-verified flag and your account creation date.</li>
              <li><strong className="text-foreground">Profile information:</strong> any of the following you choose to enter — age, weight, height, activity level, dietary restrictions, daily nutrition goals (calories, protein, carbs, fat, water), and an avatar image you pick.</li>
              <li><strong className="text-foreground">Meal data:</strong> photos you capture or upload for food recognition, the resulting food items and macros, the meal type (breakfast / lunch / dinner / snack), and the date.</li>
              <li><strong className="text-foreground">Water log:</strong> the number of glasses you log per day.</li>
              <li><strong className="text-foreground">AI coach conversations:</strong> the messages you send to and receive from the AI nutrition coach.</li>
              <li><strong className="text-foreground">Notification preferences:</strong> which notifications you've enabled and the meal-reminder times you've chosen (these are also stored on your device).</li>
              <li><strong className="text-foreground">Subscription and credits:</strong> your active plan, expiry, credit balance, redeemed coupon codes, and the receipt/customer identifiers issued by the payment processor.</li>
              <li><strong className="text-foreground">Support communications:</strong> if you submit our contact form, we keep the name, email, and message you send.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">3. Information We Do Not Collect</h2>
            <p>
              Even though Android grants permissions broadly, Nourish only uses the narrowest possible
              access. We do not access, collect, or transmit:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Your photo gallery or camera roll outside of what you explicitly capture or pick.</li>
              <li>Your contacts, call logs, or messages.</li>
              <li>Your precise or approximate location.</li>
              <li>Your microphone or any audio.</li>
              <li>Information about other apps installed on your device.</li>
              <li>Your raw password (we only ever store a one-way hash for password sign-ins).</li>
              <li>Your full card or payment-method details (those are handled exclusively by Google Play and Stripe).</li>
            </ul>
            <p className="mt-2">
              The camera permission is used only when you actively tap "scan a meal", and only for the duration of that capture.
              File-picker access for avatar uploads goes through the Android system picker, which only hands us the single file you select.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">4. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide, operate, and maintain the Nourish app and its features.</li>
              <li>Identify food in meal photos using Google's Gemini AI and estimate nutritional values.</li>
              <li>Generate personalised responses from the AI nutrition coach.</li>
              <li>Track your nutrition progress against your goals and show your history.</li>
              <li>Send local meal-time and goal-reached notifications, when you've enabled them.</li>
              <li>Manage your account, credit balance, and subscription.</li>
              <li>Send essential service-related communications (e.g. password resets, email verification).</li>
              <li>Diagnose technical issues and improve the app.</li>
            </ul>
            <p className="mt-2">
              We do not use your data to train AI models, and we do not sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">5. Third-Party Services</h2>
            <p>We rely on the following providers to operate Nourish. Each acts as a data processor on our behalf:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong className="text-foreground">Convex</strong> — hosted database where your account, profile, meals, water logs, AI chats, subscriptions, and credits are stored. Convex runs on Google Cloud infrastructure.{' '}
                <a href="https://www.convex.dev/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Convex Privacy Policy</a>.
              </li>
              <li>
                <strong className="text-foreground">Google (Vertex AI / Gemini)</strong> — meal photos are sent to Google's Gemini model for food recognition. Google processes the image to return the food items and macros, and does not retain the image after the response.{' '}
                <a href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
              </li>
              <li>
                <strong className="text-foreground">Google Play Billing</strong> — handles subscription purchases and credit-pack purchases on Android. Google issues us a purchase token; we never see your card or payment details.{' '}
                <a href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
              </li>
              <li>
                <strong className="text-foreground">Stripe</strong> — handles payments for existing subscribers on the web. Stripe stores the payment method directly; we receive a customer identifier only.{' '}
                <a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>.
              </li>
              <li>
                <strong className="text-foreground">Google Sign-In / Microsoft Sign-In (optional)</strong> — if you sign in with Google or Microsoft, those providers verify your identity and send us only your basic profile (email, name, avatar). You can use email/password instead and skip them entirely.
              </li>
              <li>
                <strong className="text-foreground">Transactional email</strong> — outgoing emails (password resets, email verification, occasional product announcements you've opted into) are sent through our email delivery provider.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">6. Data Retention</h2>
            <p>
              We keep your data only for as long as it serves a clear purpose. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-foreground">Account, profile, meals, water logs, subscription, credits:</strong> kept while your account is active.</li>
              <li><strong className="text-foreground">AI coach chat messages:</strong> automatically deleted after approximately 90 days. If you'd like to preserve a particular conversation, use the in-app "Save conversation" feature — saved conversations are kept while your account is active.</li>
              <li><strong className="text-foreground">Contact-form submissions:</strong> kept for up to 1 year, then automatically deleted.</li>
              <li><strong className="text-foreground">Failed sign-in rate-limit data:</strong> kept up to 7 days.</li>
              <li><strong className="text-foreground">Password reset codes and email verification tokens:</strong> cleared as soon as they expire (typically within a few hours of issue).</li>
              <li><strong className="text-foreground">Device-local data:</strong> sign-in token, your meal reminder times, and a small offline cache of today's meals — all wiped immediately when you sign out.</li>
            </ul>
            <p className="mt-2">
              When you delete your account from inside the app, every record tied to your user — meals, photos,
              profile, credits, subscription, chat history, water logs, saved conversations, recipe shares — is
              removed from our servers in the same operation. We may retain payment-processor records (Stripe / Google Play)
              for as long as legally required for tax, anti-fraud, or accounting purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">7. Data Storage and Security</h2>
            <p>
              Your data is stored on Convex's infrastructure, which runs on Google Cloud. Connections between the
              app and our servers are encrypted in transit using HTTPS. Passwords (for users who don't use Google
              or Microsoft sign-in) are stored only as a bcrypt one-way hash — we cannot recover the original
              password and would not know it ourselves. While we take industry-standard precautions, no method of
              internet transmission or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">8. Your Rights</h2>
            <p>
              Depending on where you live, applicable laws (such as GDPR in the European Economic Area, CCPA/CPRA
              in California, or PIPEDA in Canada) give you specific rights over your personal data. You may:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate personal data — most fields can be edited directly in the app.</li>
              <li>Request a copy of your data in a portable format.</li>
              <li>Delete your account and associated data — this is available inside the app at any time, and is processed immediately.</li>
              <li>Object to or restrict certain processing of your personal data.</li>
              <li>Withdraw any consent you previously gave (for example, opt out of promotional emails inside Notification Preferences).</li>
              <li>Lodge a complaint with a relevant data-protection authority.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:contactus@neoncell.ca" className="text-primary hover:underline">contactus@neoncell.ca</a>.
              We aim to respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">9. Children's Privacy</h2>
            <p>
              Nourish is not directed to children under the age of 13 (or under 16 in jurisdictions where that is
              the applicable threshold). We do not knowingly collect personal information from children. If you are
              a parent or guardian and believe your child has provided us with personal information, please contact
              us and we will promptly delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">10. International Users</h2>
            <p>
              Nourish is operated from Canada. By using the app, you understand that your information will be
              transferred to and processed in Canada, the United States (where our hosting and AI providers operate),
              and any other country where our service providers are located. We take steps to ensure transferred data
              receives an adequate level of protection.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes to our practices, the services,
              or applicable law. We will notify you of any material changes by updating the "Last updated" date at
              the top of this page and, for significant changes, by sending an email notification or showing an
              in-app notice. Your continued use of Nourish after the effective date of an update constitutes
              acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground mb-2">12. Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy or how your data is handled, please contact us:
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
          <div className="flex gap-4">
            <a href="/privacy/index.html" onClick={(e) => { e.preventDefault(); window.location.href = window.location.origin + '/privacy/index.html'; }} className="hover:text-foreground">Privacy</a>
            <a href="/terms/index.html" onClick={(e) => { e.preventDefault(); window.location.href = window.location.origin + '/terms/index.html'; }} className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
