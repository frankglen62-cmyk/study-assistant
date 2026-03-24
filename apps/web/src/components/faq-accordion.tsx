'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';

import { faqExpandMotion, faqChevronMotion, ease } from '@/lib/motion';

interface FaqItemProps {
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: FaqItemProps[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reduced = useReducedMotion();

  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.question}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:border-white/[0.09]"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 p-6 text-left"
            >
              <h3 className="text-base font-semibold text-white">{item.question}</h3>
              <motion.div
                variants={reduced ? undefined : faqChevronMotion}
                animate={isOpen ? 'expanded' : 'collapsed'}
                transition={{ duration: 0.22, ease: ease.snap }}
                className="shrink-0 text-neutral-500"
              >
                <Plus className="h-5 w-5" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="answer"
                  variants={reduced ? undefined : faqExpandMotion}
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 text-sm leading-relaxed text-neutral-500">
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
