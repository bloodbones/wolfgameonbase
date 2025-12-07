import { NextResponse } from "next/server";

// Account associations for each domain
const accountAssociations: Record<string, { header: string; payload: string; signature: string }> = {
  "wolfgameonbase.vercel.app": {
    header: "eyJmaWQiOjQyOSwidHlwZSI6ImF1dGgiLCJrZXkiOiIweEVDNUZlMDUyYzA0M0I0OTdkQWZlZDA1MTljRTYxMTM5OTk2ZDdkNjkifQ",
    payload: "eyJkb21haW4iOiJ3b2xmZ2FtZW9uYmFzZS52ZXJjZWwuYXBwIn0",
    signature: "2/zuK5o2c/Hf1LN787IfgrNfvx5wA7Ti0kZlH52uQFxiVN5MWd8SzMxq2U5TBZR3qPhVYg0LwQkQfBVzA7bIWxs="
  },
  "nonbankable-yuonne-trophallactic.ngrok-free.dev": {
    header: "eyJmaWQiOjQyOSwidHlwZSI6ImF1dGgiLCJrZXkiOiIweEVDNUZlMDUyYzA0M0I0OTdkQWZlZDA1MTljRTYxMTM5OTk2ZDdkNjkifQ",
    payload: "eyJkb21haW4iOiJub25iYW5rYWJsZS15dW9ubmUtdHJvcGhhbGxhY3RpYy5uZ3Jvay1mcmVlLmRldiJ9",
    signature: "1e+OgYWxfiRrKHMl1qScJk57ZXjbg/BE0bQM3mOunLRSzNIIheea1bDFRwZC9Ju4UEwzcMaHk03f/VlOca7JRBw="
  }
};

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wolfgameonbase.vercel.app";
  const domain = appUrl.replace(/^https?:\/\//, "");

  // Get the account association for this domain, fallback to prod
  const accountAssociation = accountAssociations[domain] || accountAssociations["wolfgameonbase.vercel.app"];

  const manifest = {
    accountAssociation,
    miniapp: {
      version: "1",
      name: "Wolf Game Base",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/embed.png`,
      button: {
        title: "Play",
        action: {
          type: "launch_miniapp",
          url: appUrl,
          name: "Wolf Game Base",
          splashImageUrl: `${appUrl}/icon.png`,
          splashBackgroundColor: "#1a1a1a"
        }
      },
      webhookUrl: `${appUrl}/api/webhooks/miniapp`
    }
  };

  return NextResponse.json(manifest);
}
