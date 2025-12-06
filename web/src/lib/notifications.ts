/**
 * Farcaster Mini App Notifications for Wolf Game
 *
 * Send push notifications when wolves steal sheep/mints.
 * Rate limits: 1 per 30 seconds per token, 100 daily per token
 */

import { query, getTokensByWallet } from './database';

interface NotificationPayload {
  tokens: string[];
  notificationId: string;  // Stable ID to prevent duplicates
  title: string;
  body: string;
  targetUrl: string;
}

/**
 * Send push notifications to users.
 * Batches support up to 100 tokens per request.
 */
export async function sendPushNotification(payload: NotificationPayload): Promise<void> {
  if (payload.tokens.length === 0) {
    console.log('[Notifications] No tokens to send to');
    return;
  }

  // Group tokens by notification URL
  const tokensByUrl: Record<string, string[]> = {};

  for (const token of payload.tokens) {
    const result = await query(
      'SELECT url FROM notification_tokens WHERE token = $1 AND enabled = TRUE LIMIT 1',
      [token]
    );

    if (result.rows.length > 0) {
      const url = result.rows[0].url;
      if (!tokensByUrl[url]) {
        tokensByUrl[url] = [];
      }
      tokensByUrl[url].push(token);
    }
  }

  // Send to each URL endpoint
  for (const [url, tokens] of Object.entries(tokensByUrl)) {
    // Batch tokens in groups of 100 (API limit)
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tokens: batch,
            notificationId: payload.notificationId,
            title: payload.title,
            body: payload.body,
            targetUrl: payload.targetUrl,
          }),
        });

        if (!response.ok) {
          console.error(`[Notifications] Failed to send to ${batch.length} tokens:`, await response.text());
        } else {
          console.log(`[Notifications] Sent to ${batch.length} tokens successfully`);
        }
      } catch (error) {
        console.error('[Notifications] Error sending notification:', error);
      }
    }
  }
}

/**
 * Send notification when wolf steals a sheep during unstake or mint.
 */
export async function sendWolfStealNotification(
  wolfOwnerWallet: string,
  stolenTokenId: number,
  eventType: 'unstake' | 'mint'
): Promise<{ sent: boolean; reason?: string }> {
  try {
    // Get notification tokens for the wolf owner
    const tokens = await getTokensByWallet(wolfOwnerWallet);

    if (tokens.length === 0) {
      console.log(`[Notifications] No tokens found for wallet ${wolfOwnerWallet}`);
      return { sent: false, reason: 'no_tokens' };
    }

    const tokenStrings = tokens.map(t => t.token);
    const timestamp = Date.now();

    // Create notification based on event type
    const title = eventType === 'unstake'
      ? 'Your wolf feasted!'
      : 'Your wolf intercepted!';

    const body = eventType === 'unstake'
      ? `Your wolf stole sheep #${stolenTokenId}`
      : `Your wolf stole a newly minted #${stolenTokenId}`;

    // Base URL - will be configured via env var in production
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    await sendPushNotification({
      tokens: tokenStrings,
      notificationId: `wolf-steal-${eventType}-${stolenTokenId}-${timestamp}`,
      title,
      body,
      targetUrl: baseUrl,
    });

    console.log(`[Notifications] Sent wolf steal notification for token #${stolenTokenId} (${eventType})`);
    return { sent: true };

  } catch (error) {
    console.error('[Notifications] Error sending wolf steal notification:', error);
    return { sent: false, reason: 'error' };
  }
}
