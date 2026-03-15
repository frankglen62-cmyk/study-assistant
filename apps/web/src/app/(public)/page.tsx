import Link from 'next/link';
import { ArrowRight, BookOpenText, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

import { featureCards, faqItems, heroHighlights, howItWorks, pricingTeaser } from '@/features/public/content';

export default function HomePage() {
  return (
    <div className="space-y-20 pb-20 pt-10 lg:pt-16">
      <section className="page-shell">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-8">
            <Badge tone="accent" className="gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Built for private-source, admin-controlled study workflows
            </Badge>
            <div className="space-y-5">
              <h1 className="max-w-4xl font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                A secure AI study assistant that stays grounded in the right subject and the right source set.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Admins manage every subject, folder, category, and source. Clients get suggestion-only answers,
                concise explanations, and confidence without ever seeing the raw study library.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/pricing">View Pricing</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/extension-guide">Install Extension</Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {heroHighlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[24px] border border-border/70 bg-surface/75 p-4 text-sm text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <Card className="overflow-hidden rounded-[36px] bg-gradient-to-br from-accent/12 via-background to-warning/10">
            <CardHeader>
              <CardDescription>Extension side panel preview</CardDescription>
              <CardTitle className="text-2xl">Analyze the current tab without exposing private source files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[26px] border border-border/70 bg-background/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Current session</p>
                    <p className="text-xs text-muted-foreground">Analyze Once mode</p>
                  </div>
                  <Badge tone="success">Ready</Badge>
                </div>
                <div className="space-y-3 rounded-[22px] border border-border/70 bg-surface/70 p-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <div>
                      <p className="text-sm font-medium">Detected subject: Physics</p>
                      <p className="text-xs text-muted-foreground">Category: Midterm • Confidence: 86%</p>
                    </div>
                  </div>
                  <div className="rounded-[20px] bg-muted/55 p-4 text-sm">
                    Suggested answer: Use conservation of momentum because the collision is isolated and external
                    impulse is negligible.
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-3 py-1">Change Subject</span>
                    <span className="rounded-full bg-muted px-3 py-1">View Explanation</span>
                    <span className="rounded-full bg-muted px-3 py-1">Copy Answer</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-border/70 bg-background/70 p-5">
                  <p className="text-sm font-medium">Private source access</p>
                  <p className="mt-2 text-sm text-muted-foreground">All retrieval and chunk selection stay server-side.</p>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-background/70 p-5">
                  <p className="text-sm font-medium">Credit safety</p>
                  <p className="mt-2 text-sm text-muted-foreground">Idle detection and active-session debits keep billing fair.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-shell space-y-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.18em] text-accent">Core capabilities</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            A SaaS control plane for private-source AI study assistance
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((feature, index) => (
            <Card key={feature.title} className={index === 0 ? 'xl:col-span-2' : ''}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell grid gap-6 lg:grid-cols-4">
        {howItWorks.map((item) => (
          <Card key={item.step}>
            <CardHeader>
              <Badge tone="accent">{item.step}</Badge>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="page-shell grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="bg-accent text-accent-foreground">
          <CardHeader>
            <CardDescription className="text-accent-foreground/80">Protected by design</CardDescription>
            <CardTitle className="text-3xl">
              No raw source leakage, no auto-submit behavior, and no silent tab monitoring.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-accent-foreground/85">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Private sources remain in a locked bucket and are retrieved only via server-side privileged logic.</p>
            </div>
            <div className="flex items-start gap-3">
              <BookOpenText className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Answer output is suggestion-only, with short explanation and confidence. Nothing is auto-clicked or auto-submitted.</p>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          {pricingTeaser.map((item) => (
            <Card key={item.name}>
              <CardHeader>
                <CardDescription>{item.name}</CardDescription>
                <CardTitle className="text-4xl">{item.amount}</CardTitle>
                <CardDescription>{item.detail}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/pricing">View package</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell grid gap-5 lg:grid-cols-2">
        {faqItems.map((item) => (
          <Card key={item.question}>
            <CardHeader>
              <CardTitle>{item.question}</CardTitle>
              <CardDescription>{item.answer}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
