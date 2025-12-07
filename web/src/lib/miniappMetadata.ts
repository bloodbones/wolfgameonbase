import { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://wolfgameonbase.vercel.app";

export function getMiniAppMetadata(): Metadata {
  const title = "Wolf Game On Base";
  const description = "Mint, stake, and earn WOOL with your sheep and wolves";

  // Farcaster Mini App embed JSON structure
  const miniappEmbed = {
    version: "1",
    imageUrl: `${APP_URL}/embed.png`,
    button: {
      title: "Play",
      action: {
        type: "launch_miniapp",
        name: "Wolf Game On Base",
        url: APP_URL,
        splashImageUrl: `${APP_URL}/icon.png`,
        splashBackgroundColor: "#1a1a1a"
      }
    }
  };

  // For backward compatibility with Frames v1
  const frameEmbed = {
    ...miniappEmbed,
    button: {
      ...miniappEmbed.button,
      action: {
        ...miniappEmbed.button.action,
        type: "launch_frame"
      }
    }
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: `${APP_URL}/embed.png`,
          width: 1200,
          height: 800,
        }
      ],
    },
    other: {
      // Farcaster Mini App embed (JSON in single meta tag)
      'fc:miniapp': JSON.stringify(miniappEmbed),
      // Backward compatibility with Frames v1
      'fc:frame': JSON.stringify(frameEmbed),
    },
  };
}
