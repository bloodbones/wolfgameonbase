/**
 * Notify Steal API Endpoint
 *
 * Called by the Ponder indexer when a wolf steal event occurs.
 * Sends push notification to the wolf owner.
 *
 * POST /api/notify-steal
 * Body: { wolfOwnerWallet, stolenTokenId, eventType: 'unstake' | 'mint' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendWolfStealNotification } from '@/lib/notifications';

interface NotifyStealRequest {
  wolfOwnerWallet: string;
  stolenTokenId: number;
  eventType: 'unstake' | 'mint';
}

export async function POST(request: NextRequest) {
  try {
    const body: NotifyStealRequest = await request.json();

    // Validate request body
    if (!body.wolfOwnerWallet || typeof body.stolenTokenId !== 'number' || !body.eventType) {
      return NextResponse.json(
        { error: 'Missing required fields: wolfOwnerWallet, stolenTokenId, eventType' },
        { status: 400 }
      );
    }

    if (!['unstake', 'mint'].includes(body.eventType)) {
      return NextResponse.json(
        { error: 'eventType must be "unstake" or "mint"' },
        { status: 400 }
      );
    }

    console.log(`[NotifySteal] Received steal notification request:`, body);

    // Send the notification
    const result = await sendWolfStealNotification(
      body.wolfOwnerWallet,
      body.stolenTokenId,
      body.eventType
    );

    if (result.sent) {
      return NextResponse.json({ success: true, message: 'Notification sent' });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Notification not sent',
        reason: result.reason
      });
    }

  } catch (error) {
    console.error('[NotifySteal] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
