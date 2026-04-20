'use client';

import { useState, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AuthModal } from '@/components/auth-modal';
import {
  Leaf, Camera, Brain, BarChart2, Droplets, Star,
  ArrowRight, Check, Zap, Shield, RefreshCcw, Menu, X
} from 'lucide-react';

function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-emerald-400 via-primary to-teal-400 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group rounded-2xl border border-white/5 bg-white/[0.03] p-5 hover:border-primary/30 hover:bg-white/[0.06] transition-all duration-300">
      <div className="mb-3 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function PricingCard({ name, price, period, features, cta, highlight, onCta }: {
  name: string; price: string; period: string; features: string[];
  cta: string; highlight?: boolean; onCta: () => void;
}) {
  return (
    <div className={`relative rounded-2xl border p-6 flex flex-col gap-4 ${highlight ? 'border-primary/50 bg-primary/5' : 'border-white/5 bg-white/[0.03]'}`}>
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full bg-primary text-primary-foreground">
          MOST POPULAR
        </div>
      )}
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{name}</p>
        <div className="flex items-end gap-1 mt-1">
          <span className="text-3xl font-black">{price}</span>
          <span className="text-xs text-muted-foreground mb-1">{period}</span>
        </div>
      </div>
      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />{f}
          </li>
        ))}
      </ul>
      <button onClick={onCta} className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95 ${highlight ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-white/10 hover:border-primary/40 hover:bg-white/5'}`}>
        {cta}
      </button>
    </div>
  );
}

export default function SplashPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signup');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const createOrUpdateOAuthUser = useAction(api.auth.createOrUpdateOAuthUser);

  // Redirect already-logged-in users
  useEffect(() => {
    const userId = localStorage.getItem('nourish_user_id');
    if (userId) { window.location.href = '/dashboard/'; return; }
  }, []);

  // Handle Microsoft OAuth redirect — auth code lands in ?code= query param (PKCE flow)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    if (!code) return;

    // Clean the URL immediately
    window.history.replaceState(null, '', window.location.pathname);

    const codeVerifier = sessionStorage.getItem('ms_pkce_verifier');
    if (!codeVerifier) return;
    sessionStorage.removeItem('ms_pkce_verifier');

    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '26865529-0a14-449e-8540-caddf613fa35';
    const redirectUri = window.location.origin + '/';

    (async () => {
      try {
        // Exchange authorization code for tokens
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
            scope: 'openid profile email User.Read',
          }),
        });

        if (!tokenRes.ok) {
          console.error('[Microsoft OAuth] Token exchange failed:', await tokenRes.text());
          return;
        }

        const tokens = await tokenRes.json();
        const idToken = tokens.id_token;
        const accessToken = tokens.access_token;
        if (!idToken) return;

        const base64Url = idToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        const decoded = JSON.parse(jsonPayload);
        const msEmail = decoded.preferred_username || decoded.email || decoded.upn || '';
        const msName = decoded.name || '';
        const msId = decoded.oid || decoded.sub || '';

        // Try to fetch profile photo from Microsoft Graph API
        let avatarUrl: string | undefined;
        if (accessToken) {
          try {
            const photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (photoRes.ok) {
              const blob = await photoRes.blob();
              avatarUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }
          } catch { /* avatar fetch failed, continue without it */ }
        }

        const result = await createOrUpdateOAuthUser({
          provider: 'microsoft',
          providerId: msId,
          email: msEmail,
          name: msName,
          avatarUrl,
        });
        localStorage.setItem('nourish_user_id', result.userId as string);
        if (result.name) localStorage.setItem('nourish_user_name', result.name);
        const finalAvatar = avatarUrl || result.avatarUrl;
        if (finalAvatar) localStorage.setItem('nourish_user_avatar', finalAvatar);
        if (msEmail) localStorage.setItem('nourish_user_email', msEmail);
        window.location.href = '/dashboard/';
      } catch (err) {
        console.error('[Microsoft OAuth] Failed:', err);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openSignUp = () => { setAuthTab('signup'); setAuthOpen(true); };
  const openSignIn = () => { setAuthTab('signin'); setAuthOpen(true); };

  return (
    <div className="dark min-h-screen bg-background text-foreground overflow-x-hidden">
      <style>{`
        @keyframes float-slow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        @keyframes float-fast { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-10px) rotate(5deg)} }
        @keyframes pulse-glow { 0%,100%{opacity:.4; transform:scale(1)} 50%{opacity:.8; transform:scale(1.05)} }
        @keyframes shimmer { 0%{background-position: 200% center} 100%{background-position: -200% center} }
        @keyframes spin-slow { 0%{transform:translate(-50%,-50%) rotate(0deg)} 100%{transform:translate(-50%,-50%) rotate(360deg)} }
        .float-slow { animation: float-slow 7s ease-in-out infinite }
        .float-fast { animation: float-fast 4s ease-in-out infinite }
        .pulse-glow  { animation: pulse-glow  5s ease-in-out infinite }
        .spin-slow { animation: spin-slow 120s linear infinite }
        .animate-shimmer { background-size: 200% auto; animation: shimmer 3s linear infinite; }
        .bg-grid-pattern {
          background-image: linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo.png" alt="Nourish" className="h-8 w-auto" />
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button onClick={openSignIn} className="text-sm px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors">Sign In</button>
            <button onClick={openSignUp} className="text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">Get Started</button>
          </div>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden text-muted-foreground hover:text-foreground">
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-white/5 bg-background/95 px-4 py-4 space-y-3">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground py-1">Features</a>
            <a href="#pricing" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground py-1">Pricing</a>
            <a href="/privacy" className="block text-sm text-muted-foreground py-1">Privacy</a>
            <div className="pt-2 flex flex-col gap-2">
              <button onClick={() => { openSignIn(); setMobileMenu(false); }} className="w-full text-sm py-2.5 rounded-xl border border-white/10">Sign In</button>
              <button onClick={() => { openSignUp(); setMobileMenu(false); }} className="w-full text-sm py-2.5 rounded-xl bg-primary text-primary-foreground font-medium">Get Started Free</button>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative pt-16 pb-16 md:pt-32 md:pb-24 overflow-hidden min-h-[auto] lg:min-h-screen w-full flex items-center justify-center">
        {/* Dynamic Background */}
        <div className="pointer-events-none absolute inset-0 w-full">
          <div className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)] opacity-30" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/10 blur-[120px] rounded-full" />
          <div className="pulse-glow absolute top-20 left-1/4 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px]" style={{animationDelay:'1s'}} />
          <div className="pulse-glow absolute top-40 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[120px]" style={{animationDelay:'2s'}} />
          {/* Healthy Food Plate Background Image */}
          <div className="absolute top-[45%] sm:top-[40%] left-1/2 w-[350px] h-[350px] sm:w-[450px] sm:h-[450px] md:w-[600px] md:h-[600px] opacity-[0.8] mix-blend-screen [mask-image:radial-gradient(circle,black_45%,transparent_50%)] spin-slow">
            <img src="/hero-plate.png" alt="Healthy Plate" className="w-full h-full object-cover scale-[1.1]" />
          </div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center justify-between text-center lg:text-left h-full">
          {/* Left Column: Text & CTA */}
          <div className="relative z-10 flex flex-col items-center lg:items-start max-w-2xl pt-4 lg:pt-10">
          {/* Badge */}
          <div className="relative mb-6 md:mb-8 inline-flex items-center gap-2 rounded-full p-[1px] bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-primary/50 overflow-hidden group">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="relative flex items-center gap-2 rounded-full bg-background/90 backdrop-blur-sm px-4 py-1.5 text-[10px] md:text-xs font-semibold text-primary group-hover:bg-background/80 transition-colors">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              AI-Powered Nutrition Tracking
            </div>
          </div>

          {/* Headings */}
          <h1 className="relative uppercase text-4xl sm:text-6xl md:text-[4.5rem] lg:text-[5.5rem] xl:text-7xl font-black tracking-tight leading-[1.05]">
            Snap a <GradientText>Photo.</GradientText><br />
            <span className="inline-block mt-1 sm:mt-2">Know Your</span><br />
            <span className="inline-block mt-1 sm:mt-2"><GradientText>Nutrition.</GradientText></span><br />
            <span className="relative inline-block mt-1 sm:mt-2 pb-2 md:pb-3">
              Hit Your <GradientText>Goals.</GradientText>
              <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400/0 via-primary/60 to-teal-400/0 rounded-full" />
            </span>
          </h1>

          <p className="relative mt-5 md:mt-6 text-foreground/70 text-sm sm:text-base md:text-xl max-w-xl leading-relaxed px-3 py-2 rounded-xl bg-background/40 backdrop-blur-sm">
            Snap a photo of your meal, get instant nutrition data, and chat with your personal AI nutrition coach — all in one beautiful app.
          </p>

          {/* CTA Buttons */}
          <div className="relative mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto z-10">
            <button onClick={() => window.location.href = '/dashboard/'} className="w-full sm:w-auto group relative flex items-center justify-center gap-2 px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl lg:rounded-2xl bg-primary text-primary-foreground font-bold text-sm md:text-base transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(20,184,166,0.5)] hover:shadow-[0_0_60px_-15px_rgba(20,184,166,0.7)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              Start for Free <ArrowRight className="h-4 w-4 md:h-5 md:w-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
            <button onClick={openSignIn} className="w-full sm:w-auto group flex items-center justify-center gap-2 px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl lg:rounded-2xl bg-white/[0.03] border border-white/10 text-sm md:text-base font-semibold hover:bg-white/[0.08] hover:border-white/20 transition-all hover:scale-105 active:scale-95 backdrop-blur-md">
              Sign In
            </button>
          </div>

          <div className="relative z-20 mt-5 md:mt-8 flex justify-center lg:justify-start w-full sm:w-auto">
            <div className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-xl">
              <Shield className="w-3 h-3 md:w-4 md:h-4 text-emerald-400" />
              <span className="text-[11px] md:text-sm font-semibold text-white tracking-wide">
                Free to get started · No credit card required
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual (Mockup) */}
        <div className="relative mt-2 sm:mt-8 md:mt-16 lg:-mt-16 lg:ml-10 z-10 w-full flex-1 flex justify-center lg:justify-end min-h-[400px] sm:min-h-[500px] [perspective:1200px]">
          {/* Spectacular floating app mockup */}
          <div className="relative w-full max-w-[280px] sm:max-w-[340px] md:max-w-[360px] mx-auto lg:mx-0 lg:mr-10 z-10">
            <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl lg:rounded-[2.5rem] blur-2xl opacity-40 pulse-glow" />
            
            <div className="relative float-slow transition-transform duration-700 ease-out hover:[transform:rotateX(5deg)_rotateY(-10deg)] border border-white/10 rounded-[2rem] lg:rounded-[2.5rem] bg-card/85 backdrop-blur-2xl shadow-2xl overflow-hidden p-[2px]">
              <div className="relative rounded-[1.8rem] lg:rounded-[2.4rem] bg-black/60 border border-white/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />
                
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-primary to-teal-400" />
                <div className="p-4 sm:p-5 lg:p-6 space-y-4 lg:space-y-5">
                  <div className="flex items-center gap-2 lg:gap-3">
                    <img src="/logo-icon.png" alt="Nourish" className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl object-contain" />
                    <span className="text-sm lg:text-base font-bold tracking-tight">Nourish</span>
                    <div className="ml-auto text-[9px] lg:text-[10px] text-primary font-bold bg-primary/10 border border-primary/20 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.2)]">Pro</div>
                  </div>

                  <div className="relative rounded-xl lg:rounded-2xl bg-white/[0.05] border border-white/10 p-3 lg:p-4 overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 lg:w-32 lg:h-32 bg-primary/20 rounded-full blur-2xl -translate-y-10 translate-x-10 group-hover:scale-150 transition-transform duration-700" />
                    <p className="text-[9px] lg:text-[11px] font-medium text-muted-foreground mb-3 lg:mb-4 uppercase tracking-wider">Today&apos;s Macros</p>
                    <div className="flex justify-between relative z-10 px-1">
                      {[
                        { l: 'Calories', v: '1,840', c: 'text-primary' },
                        { l: 'Protein', v: '124g', c: 'text-blue-400' },
                        { l: 'Carbs', v: '210g', c: 'text-amber-400' }
                      ].map(({ l, v, c }) => (
                        <div key={l} className="flex flex-col gap-1 lg:gap-1.5">
                          <p className="text-[9px] lg:text-[11px] text-muted-foreground/80">{l}</p>
                          <p className={`text-sm lg:text-base font-black tracking-tight ${c}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl lg:rounded-2xl bg-white/[0.05] border border-white/10 p-3 lg:p-4 space-y-2 lg:space-y-3.5">
                    <div className="flex items-center gap-1.5 lg:gap-2">
                      <Brain className="w-3 h-3 lg:w-4 lg:h-4 text-primary" />
                      <p className="text-[9px] lg:text-[11px] font-medium text-muted-foreground uppercase tracking-wider">AI Coach Overview</p>
                    </div>
                    <div className="relative rounded-lg lg:rounded-xl bg-gradient-to-r from-primary/10 to-teal-500/5 border border-primary/10 p-3 lg:p-4">
                      <div className="absolute top-0 right-0 w-10 h-10 lg:w-12 lg:h-12 bg-primary/30 rounded-bl-3xl blur-md" />
                      <p className="text-xs lg:text-sm text-primary/90 font-medium leading-relaxed">
                        Excellent progress today! You hit your protein goal and stayed 360 kcal under limit. Perfect for your deficit phase. 🥗✨
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 lg:-bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-6 lg:h-8 bg-black/60 blur-xl rounded-[100%]" />
          </div>
        </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black">Everything you need to <GradientText>thrive</GradientText></h2>
            <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-sm mx-auto">From instant meal recognition to personalised coaching — built for real life.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <FeatureCard icon={<Camera className="h-5 w-5" />} title="Instant Meal Scanning" desc="Point your camera at any meal and get full nutrition data in seconds — powered by Gemini AI." />
            <FeatureCard icon={<Brain className="h-5 w-5" />} title="AI Nutrition Coach" desc="Ask anything about your diet. Your coach knows your history and helps you hit your goals." />
            <FeatureCard icon={<BarChart2 className="h-5 w-5" />} title="Macro Tracking" desc="Track calories, protein, carbs and fat effortlessly across breakfast, lunch, dinner and snacks." />
            <FeatureCard icon={<Droplets className="h-5 w-5" />} title="Water Tracking" desc="Stay hydrated with a simple tap-to-log tracker that keeps you on target all day." />
            <FeatureCard icon={<RefreshCcw className="h-5 w-5" />} title="Rolling Credits" desc="Monthly credits that roll over — never lose what you've paid for." />
            <FeatureCard icon={<Shield className="h-5 w-5" />} title="Secure & Private" desc="Your data stays yours — protected with end-to-end security and stored safely in the cloud." />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-16 md:py-24 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black">Simple, honest <GradientText>pricing</GradientText></h2>
            <p className="text-sm md:text-base text-muted-foreground mt-3">Start free. Upgrade when you're ready.</p>
          </div>
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit mx-auto mb-8">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-white/10 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-white/10 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Yearly
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Save 25%</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 max-w-xl mx-auto">
            <PricingCard name="Free" price="$0" period="/ forever" features={['1 meal scan/day','1 AI message/day','Basic tracking']} cta="Get Started" onCta={openSignUp} />
            {billingCycle === 'monthly' ? (
              <PricingCard name="Pro Monthly" price="$3.99" period="/ month" features={['300 credits/month','Credits roll over','1 free daily scan included','Cancel anytime']} cta="Subscribe" highlight onCta={openSignUp} />
            ) : (
              <PricingCard name="Pro Yearly" price="$34.99" period="/ year" features={['300 credits/month','Credits roll over','1 free daily scan included','~$2.92/mo — Save 27%']} cta="Subscribe" highlight onCta={openSignUp} />
            )}
          </div>
          <p className="text-center text-[11px] md:text-xs text-muted-foreground mt-6">
            Already a subscriber? Additional credit packs available inside the app.
          </p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10"><h2 className="text-3xl sm:text-4xl md:text-5xl font-black">Loved by users</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
            {[
              {name:'Sarah K.',text:"I've tried every calorie app out there. Nourish is the only one where I actually enjoyed the experience."},
              {name:'Marcus L.',text:"The AI coach is like having a nutritionist in my pocket. It actually remembers what I ate and gives real advice."},
              {name:'Priya M.',text:"Scanning meals is mind-blowing. It recognised my homemade curry and got the macros almost perfect."},
            ].map(({name,text}) => (
              <div key={name} className="flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-colors">
                <div className="flex gap-1 mb-4">{Array(5).fill(0).map((_,i)=><Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400"/>)}</div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">&ldquo;{text}&rdquo;</p>
                <p className="text-sm font-semibold">{name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-xl mx-auto text-center">
          <div className="relative rounded-[2rem] border border-primary/20 bg-primary/5 p-8 sm:p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-teal-500/5" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-black mb-3 leading-tight">Ready to eat <GradientText>smarter?</GradientText></h2>
              <p className="text-sm md:text-base text-muted-foreground mb-8">Join thousands already tracking their nutrition with Nourish.</p>
              <button onClick={openSignUp} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm md:text-base hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/25">
                Start for Free <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4 text-xs md:text-sm text-muted-foreground text-center sm:text-left">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Nourish" className="h-7 w-auto" />
            <span className="opacity-50">· © {new Date().getFullYear()}</span>
          </div>
          <span>Get more apps on <a href="https://www.digitalac.app" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">www.Digitalac.app</a></span>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </div>
        </div>
      </footer>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />
    </div>
  );
}
