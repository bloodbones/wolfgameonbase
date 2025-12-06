/**
 * Farcaster Mini App Webhook Endpoint
 *
 * Receives webhook events from Farcaster when users:
 * - Add the Mini App (miniapp_added)
 * - Remove the Mini App (miniapp_removed)
 * - Enable notifications (notifications_enabled)
 * - Disable notifications (notifications_disabled)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  query,
  upsertUser,
  saveNotificationToken,
  disableTokensForUser,
  deleteTokensForUser,
  setUserNotificationsEnabled,
} from '@/lib/database';

interface NotificationDetails {
  url: string;
  token: string;
}

interface WebhookEvent {
  event: 'miniapp_added' | 'miniapp_removed' | 'notifications_enabled' | 'notifications_disabled' | 'frame_added' | 'frame_removed';
  notificationDetails?: NotificationDetails;
}

interface FarcasterSignedMessage {
  header: string;
  payload: string;
  signature: string;
}

function decodeBase64Url(str: string): any {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const jsonString = Buffer.from(base64, 'base64').toString('utf-8');
  return JSON.parse(jsonString);
}

export async function POST(request: NextRequest) {
  try {
    const signedMessage: FarcasterSignedMessage = await request.json();

    // Extract FID and event from signed message
    const header = decodeBase64Url(signedMessage.header);
    const payload = decodeBase64Url(signedMessage.payload);
    const fid = header.fid;
    const eventData: WebhookEvent = payload;

    // Extract wallet address if available in the payload
    // The wallet can come from different places depending on the event
    const walletAddress = payload.address || payload.walletAddress || null;

    console.log(`[Webhook] ${eventData.event} from FID ${fid}`);
    console.log(`[Webhook] Wallet: ${walletAddress || 'not provided'}`);

    // Find or create user with wallet address
    let userResult = await query('SELECT id FROM users WHERE fid = $1', [fid]);
    let userId: number;

    if (userResult.rows.length === 0) {
      // Create new user
      const user = await upsertUser({ fid, wallet_address: walletAddress });
      userId = user.id;
      console.log(`[Webhook] Created new user ${userId} for FID ${fid}`);
    } else {
      userId = userResult.rows[0].id;
      // Update wallet address if provided and user exists
      if (walletAddress) {
        await query(
          'UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE id = $2',
          [walletAddress, userId]
        );
        console.log(`[Webhook] Updated wallet for user ${userId}`);
      }
    }

    // Handle event
    switch (eventData.event) {
      case 'miniapp_added':
      case 'frame_added':
      case 'notifications_enabled':
        if (eventData.notificationDetails) {
          console.log(`[Webhook] Saving notification token for user ${userId}`);
          await saveNotificationToken(
            userId,
            fid,
            eventData.notificationDetails.token,
            eventData.notificationDetails.url
          );
          await setUserNotificationsEnabled(userId, true);
          console.log(`[Webhook] Notification token saved successfully`);
        } else {
          console.log(`[Webhook] No notificationDetails in event`);
        }
        break;

      case 'notifications_disabled':
        console.log(`[Webhook] Disabling notifications for user ${userId}`);
        await disableTokensForUser(userId);
        await setUserNotificationsEnabled(userId, false);
        break;

      case 'miniapp_removed':
      case 'frame_removed':
        console.log(`[Webhook] Removing notification tokens for user ${userId}`);
        await deleteTokensForUser(userId);
        await setUserNotificationsEnabled(userId, false);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
