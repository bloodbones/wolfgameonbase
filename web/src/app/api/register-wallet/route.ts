/**
 * Register Wallet API Endpoint
 *
 * Called by the Mini App client to link a wallet address to a FID.
 * This enables sending notifications to users based on their wallet address.
 *
 * POST /api/register-wallet
 * Body: { fid, walletAddress }
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

interface RegisterWalletRequest {
  fid: number;
  walletAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterWalletRequest = await request.json();

    if (!body.fid || !body.walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: fid, walletAddress' },
        { status: 400 }
      );
    }

    console.log(`[RegisterWallet] FID ${body.fid} -> ${body.walletAddress}`);

    // Upsert user with wallet address
    await query(
      `INSERT INTO users (fid, wallet_address, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (fid) DO UPDATE SET
         wallet_address = $2,
         updated_at = NOW()`,
      [body.fid, body.walletAddress.toLowerCase()]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[RegisterWallet] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
