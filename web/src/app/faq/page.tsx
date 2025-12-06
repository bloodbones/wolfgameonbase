'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import Link from 'next/link';

interface FAQItemProps {
  question: string;
  answer: React.ReactNode;
  defaultOpen?: boolean;
}

function FAQItem({ question, answer, defaultOpen = false }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left hover:text-primary transition"
      >
        <span className="font-medium pr-4">{question}</span>
        <svg
          className={`w-5 h-5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-4 text-muted-foreground text-sm">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto p-4 sm:p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Game
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Frequently Asked Questions</h1>

        {/* WOOL Distribution */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-primary">WOOL Distribution</h2>

          <FAQItem
            question="How does the 20% wolf tax work?"
            defaultOpen={true}
            answer={
              <p>
                When a Sheep claims WOOL, 20% is distributed to <strong>ALL staked Wolves</strong> proportionally
                based on their Alpha scores. It's not given to one specific wolf - all wolves share it.
              </p>
            }
          />

          <FAQItem
            question="How are wolf earnings calculated?"
            answer={
              <div className="space-y-2">
                <p>Wolf earnings = <code className="bg-muted px-1 rounded">(currentWoolPerAlpha - stakedWoolPerAlpha) × alphaScore</code></p>
                <p>The contract maintains a woolPerAlpha accumulator that increases whenever tax comes in.
                Each wolf's share is based on their Alpha score (5-8).</p>
              </div>
            }
          />

          <FAQItem
            question="If my sheep gets stolen during unstaking, does the stealing wolf get my WOOL?"
            answer={
              <div className="space-y-2">
                <p>No, they are separate:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>The <strong>sheep NFT</strong> goes to one random wolf (weighted by Alpha)</li>
                  <li>The <strong>accumulated WOOL</strong> goes to ALL wolves (distributed via the tax pool)</li>
                </ul>
                <p>The wolf that steals the NFT is not necessarily the same wolves receiving the WOOL.</p>
              </div>
            }
          />

          <FAQItem
            question="What happens to WOOL when it's 'burned'?"
            answer={
              <div className="space-y-2">
                <p>When you spend WOOL to mint Gen 1 NFTs, the tokens are permanently destroyed:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Your balance decreases</li>
                  <li>Total supply decreases</li>
                  <li>No one receives the tokens - they're gone</li>
                </ul>
                <p>This is different from the wolf tax, where WOOL is transferred to wolves.</p>
              </div>
            }
          />
        </section>

        {/* Claiming vs Unstaking */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-primary">Claiming vs Unstaking</h2>

          <FAQItem
            question="What's the difference between Claim and Unstake?"
            answer={
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4"></th>
                      <th className="text-left py-2 pr-4">Claim</th>
                      <th className="text-left py-2">Unstake</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-2 pr-4 font-medium">WOOL</td>
                      <td className="py-2 pr-4">Get 80% (20% to wolves)</td>
                      <td className="py-2">If successful: 100% (no tax!)</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 pr-4 font-medium">NFT</td>
                      <td className="py-2 pr-4">Stays staked</td>
                      <td className="py-2">Returns to wallet</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">Risk</td>
                      <td className="py-2 pr-4">None</td>
                      <td className="py-2">50% chance sheep is stolen</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            }
          />

          <FAQItem
            question="If I successfully unstake, do I still pay the 20% tax?"
            answer={
              <p>
                <strong>No!</strong> Successful unstaking gives you 100% of accumulated WOOL with no tax.
                The tax only applies when claiming without unstaking.
              </p>
            }
          />

          <FAQItem
            question="What happens if my sheep is stolen during unstaking?"
            answer={
              <div className="space-y-2">
                <p>You lose:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>The sheep NFT (goes to a wolf owner)</li>
                  <li>ALL accumulated WOOL (goes to wolf tax pool)</li>
                </ul>
              </div>
            }
          />
        </section>

        {/* Multi-Token Operations */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-primary">Multi-Token Operations</h2>

          <FAQItem
            question="What happens when I unstake multiple sheep at once?"
            answer={
              <div className="space-y-2">
                <p>Each sheep has its own independent 50% roll. If you unstake 4 sheep:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Each gets a separate random check</li>
                  <li>You could have any combination (0-4 stolen)</li>
                  <li>Results shown in popup: "2 sheep stolen, 2 returned"</li>
                </ul>
              </div>
            }
          />

          <FAQItem
            question="Can I unstake sheep and wolves together?"
            answer={
              <p>
                Yes. Wolves always return safely (no steal risk). Only sheep have the 50% steal chance.
              </p>
            }
          />
        </section>

        {/* Technical */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-primary">Technical</h2>

          <FAQItem
            question="Why don't wolf earnings update in real-time like sheep?"
            answer={
              <div className="space-y-2">
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Sheep earnings tick up every second (calculated from stake timestamp)</li>
                  <li>Wolf earnings only change when woolPerAlpha increases on-chain</li>
                  <li>The UI polls every 30 seconds for updates</li>
                  <li>After your own claim, it updates immediately</li>
                </ul>
              </div>
            }
          />

          <FAQItem
            question="What is the 2-day lock period?"
            answer={
              <p>
                After staking, you must wait 2 days before you can unstake. Claiming is always available.
              </p>
            }
          />

          <FAQItem
            question="What are Alpha scores?"
            answer={
              <div className="space-y-2">
                <p>Wolves have Alpha values from 5-8:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Alpha 8:</strong> Rarest, highest earnings share</li>
                  <li><strong>Alpha 5:</strong> Most common, lowest earnings share</li>
                </ul>
                <p className="mt-2">Alpha determines:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Share of the 20% tax pool</li>
                  <li>Probability of stealing sheep/mints (weighted random)</li>
                </ol>
              </div>
            }
          />
        </section>

        <div className="text-center">
          <Link
            href="/how-to-play"
            className="text-sm text-primary hover:underline"
          >
            New to the game? Read How to Play
          </Link>
        </div>
      </main>
    </div>
  );
}
