import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Sparkles, MessageSquare, Bell, Search, Zap, Clock, CheckCircle2, ArrowRight,
  Shield, MapPin,
} from "lucide-react";

/**
 * Core capabilities ordered by business flow:
 * Orders arrive → match → route → notify customer → chase tracking →
 * flag exceptions → stock alerts → EOD briefing → audit trail
 */
const coreFeatures = [
  { icon: MessageSquare, title: "Multi-Channel Sync", desc: "Orders from every platform in one view — no more tab-switching or copy-pasting between spreadsheets" },
  { icon: Zap, title: "Order Matching", desc: "Matches incoming responses to the right orders and updates records instantly — zero manual work" },
  { icon: MapPin, title: "Instant Order Routing", desc: "New orders automatically matched to the right warehouse or location for fastest fulfilment" },
  { icon: Bell, title: "Auto Customer Updates", desc: "Proactive dispatch & delivery notifications — customers stop asking 'where's my order?'" },
  { icon: Search, title: "Tracking Chase", desc: "Automatically chases missing tracking numbers from carriers and distributors — persistent, polite, relentless" },
  { icon: Shield, title: "Auto Exception Flagging", desc: "Detects anomalies like missing items, address issues, and weight mismatches — raises exceptions automatically" },
  { icon: Bot, title: "Smart Stock Alerts", desc: "Warns you before you run out — not after orders start failing. Tracks trends and predicts shortages" },
  { icon: Clock, title: "EOD Team Briefings", desc: "End-of-day summaries straight to WhatsApp — orders shipped, exceptions raised, stock alerts" },
  { icon: CheckCircle2, title: "Full Audit Trail", desc: "Every action logged, every message traceable — complete operational visibility" },
];

const PHASES = [
  {
    phase: "Phase 1",
    label: "Zero Manual Order Chasing",
    hook: "I need this today",
    status: "In Development",
    items: [
      { name: "Shopify + WooCommerce Sync", desc: "All your sales channels feeding orders into one place — no more copy-pasting between platforms" },
      { name: "EasyPost Unified Tracking", desc: "Live tracking webhooks for 100+ carriers — you'll never manually chase a tracking number again" },
      { name: "Auto Customer Notifications", desc: "Dispatch & delivery emails sent automatically — kill 'where is my order?' forever" },
      { name: "Low Stock Alerts", desc: "Get warned before you run out — not after orders start failing" },
    ],
  },
  {
    phase: "Phase 2",
    label: "Everything in One Place",
    hook: "This saves me a day a week",
    status: "Next Up",
    items: [
      { name: "eBay + Amazon + TikTok Shop", desc: "Consolidate marketplace orders with automatic fulfilment sync" },
      { name: "Carrier Tracking Chase", desc: "Agent follows up with carriers on missing tracking — persistent, polite, relentless" },
      { name: "Customer Chase Automation", desc: "Auto-follow-up on unresolved queries, returns, and payment issues" },
      { name: "WhatsApp COB Summary", desc: "Daily team briefing — what shipped, what's stuck, what needs attention tomorrow" },
    ],
  },
  {
    phase: "Phase 3",
    label: "The Back Office Sorts Itself",
    hook: "I'm running a proper business now",
    status: "Planned",
    items: [
      { name: "Xero / QuickBooks / MYOB", desc: "Invoices, payments, and reconciliation sync automatically — your numbers finally match" },
      { name: "Klaviyo / Mailchimp", desc: "Trigger marketing flows from dispatch & delivery events" },
      { name: "Tawk.to / Zendesk Matching", desc: "Support tickets auto-matched to orders, responses logged" },
      { name: "Shipping@ Inbox Monitoring", desc: "Dedicated email account monitoring — distribution and support, organised and actioned" },
    ],
  },
  {
    phase: "Phase 4",
    label: "AI Does the Thinking",
    hook: "I'm ready to scale",
    status: "Planned",
    items: [
      { name: "Full AI Agent", desc: "Chasing, drafting, summarising — Claude-powered operations assistant" },
      { name: "Google Drive Auto-Import", desc: "Drop files in a folder, agent imports via existing pipeline — no manual upload" },
      { name: "PayPal / Afterpay Reconciliation", desc: "Payment status matched against orders automatically" },
      { name: "Etsy + Emerging Channels", desc: "New sales channels plugged in as you grow" },
      { name: "Slack / Telegram / Trello", desc: "Exception cards, urgent alerts, and team channel summaries" },
    ],
  },
];

const phaseColors: Record<string, string> = {
  "In Development": "bg-primary/15 text-primary border-primary/25",
  "Next Up": "bg-accent/50 text-accent-foreground border-accent/30",
  "Planned": "bg-muted text-muted-foreground border-border",
};

const phaseEmoji: Record<string, string> = {
  "In Development": "🔥",
  "Next Up": "⚡",
  "Planned": "🗺️",
};

function EarlyAccessCTA() {
  return (
    <Card className="border-dashed border-primary/20 bg-primary/[0.03]">
      <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-sm font-medium text-foreground">Want early access?</p>
          <p className="text-xs text-muted-foreground">We'll notify you as soon as the AI Agent is ready for your account.</p>
        </div>
        <Button size="sm" className="shrink-0 gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Get Early Access
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AIAgentPage() {
  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-5xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-8 sm:p-12">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <Badge className="bg-primary/15 text-primary border-primary/25 hover:bg-primary/20 gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3 h-3" /> Coming Soon
            </Badge>
          </div>

          <div className="space-y-4 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              FulfillMate AI Agent
            </h1>
            <p className="text-base sm:text-lg text-primary font-semibold leading-snug">
              Connects all your sales channels, automatically updates customers with tracking, and chases the ones you'd forget — so you stop living in your inbox.
            </p>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Early testers expect to <span className="font-semibold text-foreground">cut customer service emails by over half</span> in week one.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How it connects — visual pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        {[
          { icon: MessageSquare, label: "Your Channels", sub: "Shopify · WooCommerce · eBay · Amazon", color: "text-blue-400" },
          { icon: Bot, label: "FulfillMate AI Agent", sub: "Reads · Matches · Chases · Logs", color: "text-primary" },
          { icon: CheckCircle2, label: "Customers + Team + Records", sub: "Updated automatically", color: "text-emerald-400" },
        ].map((step, i) => (
          <div key={step.label} className="flex items-center gap-3">
            <Card className={cn(
              "flex-1 border-border/50 bg-card/50",
              i === 1 && "border-primary/25 bg-primary/[0.03]"
            )}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  i === 1 ? "bg-primary/15" : "bg-muted"
                )}>
                  <step.icon className={cn("w-4.5 h-4.5", step.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{step.label}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{step.sub}</p>
                </div>
              </CardContent>
            </Card>
            {i < 2 && <ArrowRight className="w-5 h-5 text-primary shrink-0 hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* Core feature grid */}
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Core Capabilities</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((f) => (
            <Card key={f.title} className="bg-card/50 border-border/50 hover:border-primary/20 transition-colors group">
              <CardHeader className="pb-2">
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Divider between Capabilities and Roadmap */}
      <EarlyAccessCTA />

      {/* Roadmap phases */}
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Integration Roadmap</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PHASES.map((phase) => (
            <Card key={phase.phase} className="bg-card border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{phase.phase}</p>
                    <CardTitle className="text-sm font-semibold mt-0.5">{phase.label}</CardTitle>
                    <p className="text-xs text-muted-foreground italic mt-0.5">"{phase.hook}"</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] font-semibold", phaseColors[phase.status])}>
                    {phaseEmoji[phase.status]} {phase.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2.5">
                  {phase.items.map((item) => (
                    <div key={item.name} className="flex gap-2.5">
                      <div className="w-1 rounded-full bg-primary/20 shrink-0 mt-1" style={{ minHeight: 24 }} />
                      <div>
                        <p className="text-xs font-medium text-foreground">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <EarlyAccessCTA />
    </div>
  );
}
