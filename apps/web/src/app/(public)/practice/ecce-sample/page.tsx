import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';
import { BookOpenText, ClipboardCheck, ShieldCheck } from 'lucide-react';

const questionBlocks = [
  {
    id: 'ecce-q1',
    eyebrow: 'Question 1',
    prompt: 'The teaching learning process in an ECCE centre must be based on:',
    options: [
      'play and supervision',
      'play and monitoring',
      'activity and play based',
      'activity and coordination',
    ],
  },
  {
    id: 'ecce-q2',
    eyebrow: 'Question 2',
    prompt: 'An important milestone of cognitive development in toddlers is:',
    options: [
      "distinguishing between 'you' and 'me'",
      "responding to the mother's voice",
      'beginning to babble and gurgle',
      'wriggling and kicking arms and legs',
    ],
  },
  {
    id: 'ecce-q3',
    eyebrow: 'Question 3',
    prompt: 'The social value of play is best shown by:',
    options: [
      'ensuring proper coordination of muscles',
      'developing friendly relationships',
      'developing creativity and imagination',
      'learning to respect elders',
    ],
  },
  {
    id: 'ecce-q4',
    eyebrow: 'Question 4',
    prompt: 'An important indicator of development and progress of children is:',
    options: [
      'avoiding challenging activities',
      'showing indifference to their surroundings',
      'enjoying and coping well with age appropriate activities',
      'being disinterested in skills like art, music and numbers',
    ],
  },
];

const supportingSignals = [
  'Course code: ECCE101',
  'Subject: Early Childhood Care and Education',
  'Category: Semestral Practice',
  'Topic: Teaching learning process in an ECCE centre',
];

export default function EcceSamplePracticePage() {
  return (
    <div className="page-shell space-y-8 pb-20 pt-10">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-accent/20 bg-gradient-to-br from-accent/12 via-background to-background">
          <CardHeader className="space-y-4">
            <Badge tone="accent" className="w-fit gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Safe extension practice page
            </Badge>
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Chrome extension mock page</p>
              <CardTitle className="font-display text-4xl tracking-tight">
                Early Childhood Care and Education
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                This page is a non-graded local practice surface for testing the extension on visible question text. It
                is designed to resemble a semestral reviewer flow without answering or submitting anything.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {supportingSignals.map((item) => (
              <div key={item} className="rounded-[22px] border border-border/70 bg-background/60 p-4 text-sm text-foreground">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-accent" />
              How to test the extension here
            </CardTitle>
            <CardDescription>
              Use this route instead of a live graded page. The extension should detect the ECCE subject and produce a
              suggestion from the seeded private reviewer source.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-[22px] border border-border/70 bg-background/50 p-4">
              1. Start a client session in the portal or extension.
            </div>
            <div className="rounded-[22px] border border-border/70 bg-background/50 p-4">
              2. Keep this question visible, then open the side panel and click <span className="font-medium text-foreground">Analyze Page</span>.
            </div>
            <div className="rounded-[22px] border border-border/70 bg-background/50 p-4">
              3. Expected result: the side panel should show multiple question suggestions from the seeded ECCE reviewer, not just a single answer.
            </div>
            <div className="rounded-[22px] border border-warning/20 bg-warning/10 p-4 text-foreground">
              This page does not auto-submit, auto-select, or simulate a graded LMS attempt.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-background/60">
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Sample question paper</p>
            <CardTitle className="text-3xl">Semestral Practice Question</CardTitle>
            <CardDescription>
              Choose the correct answer from the options below. This block is intentionally visible and text-rich for
              extension analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {questionBlocks.map((question, questionIndex) => (
              <div
                key={question.id}
                data-question-block=""
                data-question-id={question.id}
                data-question-label="Semestral practice"
                className="rounded-[24px] border border-border/70 bg-background/50 p-5"
              >
                <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">{question.eyebrow}</p>
                <h2 data-question-prompt="" className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {question.prompt}
                </h2>
                <div className="mt-5 grid gap-3">
                  {question.options.map((option, index) => (
                    <label
                      key={option}
                      data-question-option=""
                      className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-background/60 px-4 py-3 text-sm text-foreground"
                    >
                      <input type="radio" name={question.id} value={option} className="h-4 w-4 accent-[var(--accent)]" />
                      <span className="font-medium text-muted-foreground">({['i', 'ii', 'iii', 'iv'][index]})</span>
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {questionIndex === 1 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    This visible block helps the extractor verify that more than one question can be captured from the
                    current tab in a single analysis cycle.
                  </p>
                ) : null}
              </div>
            ))}

            <div className="rounded-[24px] border border-border/70 bg-background/50 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Additional visible context</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] bg-background/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Common ECCE themes</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Play based learning, child development, cognitive growth, social interaction, and age-appropriate
                    activities.
                  </p>
                </div>
                <div className="rounded-[20px] bg-background/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Testing note</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The extension should retrieve from the private ECCE reviewer source and return a suggestion-only
                    answer with explanation and confidence.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenText className="h-5 w-5 text-accent" />
              Practice notes
            </CardTitle>
            <CardDescription>
              These notes are page signals only. The actual answer should still come from the private source library,
              not from a visible answer key on this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-[22px] border border-border/70 bg-background/50 p-4">
              No answer key is shown here.
            </div>
            <div className="rounded-[22px] border border-border/70 bg-background/50 p-4">
              The extension may use the page title, headings, labels, visible text, and question block to detect the
              subject.
            </div>
            <div className="rounded-[22px] border border-border/70 bg-background/50 p-4">
              This page intentionally exposes four visible question blocks so the extension can test multi-question
              extraction without clicking any choices.
            </div>
            <div className="rounded-[22px] border border-border/70 bg-background/50 p-4">
              If detection confidence is low, manually confirm the subject as
              <span className="mx-1 font-medium text-foreground">Early Childhood Care and Education</span>
              and the category as
              <span className="mx-1 font-medium text-foreground">Semestral</span>.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
