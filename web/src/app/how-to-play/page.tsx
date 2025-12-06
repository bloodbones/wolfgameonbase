'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';

export default function HowToPlay() {
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

        <h1 className="text-2xl sm:text-3xl font-bold mb-6">How to Play</h1>

        {/* Overview */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Overview</h2>
          <p className="text-muted-foreground">
            Wolf Game is an NFT staking game where Sheep earn WOOL tokens and Wolves tax and steal from them.
          </p>
        </section>

        {/* Minting */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Minting NFTs</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Gen 0</strong> (tokens 1-10,000): Mint with ETH</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Gen 1</strong> (tokens 10,001+): Mint with WOOL tokens</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>90% chance of minting a Sheep, 10% chance of Wolf</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Gen 1 mints have a 10% chance of being stolen by a staked Wolf</span>
            </li>
          </ul>
        </section>

        {/* Sheep */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Sheep</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              <span>Stake sheep in the Barn to earn <strong>10,000 WOOL per day</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              <span>When claiming WOOL: <strong>20% goes to Wolves</strong> as tax</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              <span>When unstaking: <strong>50% chance</strong> your sheep gets stolen by a Wolf</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              <span>2-day lock period after staking before you can unstake</span>
            </li>
          </ul>
        </section>

        {/* Wolves */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Wolves</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>Wolves have an Alpha score (5-8) - higher is better</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>Earn WOOL from the 20% tax when Sheep claim</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>Higher Alpha = larger share of the tax pool</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>Can steal Sheep when they try to unstake</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>Can steal newly minted Gen 1 NFTs</span>
            </li>
          </ul>
        </section>

        {/* Actions Table */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Actions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-semibold">Action</th>
                  <th className="text-left py-2 font-semibold">What Happens</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border">
                  <td className="py-3 pr-4 font-medium text-foreground">Stake</td>
                  <td className="py-3">Lock your NFT in the Barn to start earning</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 pr-4 font-medium text-foreground">Claim</td>
                  <td className="py-3">Collect earned WOOL (Sheep pay 20% tax)</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-foreground">Unstake</td>
                  <td className="py-3">Remove NFT from Barn (Sheep have 50% steal risk)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Tips */}
        <section className="mb-8 p-4 bg-muted rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Quick Tips</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Sheep earn WOOL over time - claim regularly</li>
            <li>Wolves earn passively from Sheep taxes - no action needed</li>
            <li>Unstaking Sheep is risky - consider just claiming instead</li>
            <li>Higher Alpha wolves earn more from the tax pool</li>
          </ol>
        </section>

        <div className="text-center">
          <Link
            href="/faq"
            className="text-sm text-primary hover:underline"
          >
            Have questions? Check the FAQ
          </Link>
        </div>
      </main>
    </div>
  );
}
