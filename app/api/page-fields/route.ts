import { NextRequest, NextResponse } from "next/server";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAuthToken(): Promise<string | null> {
  const clientId = process.env.SITECORE_CLIENT_ID;
  const clientSecret = process.env.SITECORE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const response = await fetch("https://auth.sitecorecloud.io/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: "https://api.sitecorecloud.io",
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      console.error(`Failed to get auth token: ${response.status}`);
      cachedToken = null;
      return null;
    }

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000 - 60000;
    cachedToken = { token: data.access_token, expiresAt };
    return data.access_token;
  } catch (error) {
    console.error("Error fetching auth token:", error);
    cachedToken = null;
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, language, templateName, sitecoreContextId } = body;

    if (!path || !language || !templateName) {
      return NextResponse.json(
        { error: "path, language, and templateName are required" },
        { status: 400 }
      );
    }

    const contextId =
      sitecoreContextId || process.env.SITECORE_PREVIEW_CONTEXT_ID;
    if (!contextId) {
      return NextResponse.json(
        {
          error:
            "sitecoreContextId is required (pass in body or set SITECORE_PREVIEW_CONTEXT_ID)",
        },
        { status: 400 }
      );
    }

    const graphqlQuery = `
      query {
        item(path: "${path.replace(/"/g, '\\"')}", language: "${language}") {
          ... on ${templateName} {
            title { value }
            content { value }
          }
        }
      }
    `;

    const contentApiUrl = `https://edge-platform.sitecorecloud.io/content/api/graphql/v1?sitecoreContextId=${encodeURIComponent(contextId)}`;

    const authToken = await getAuthToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(contentApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: graphqlQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Content API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Content API returned ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (result.errors?.length) {
      console.error("GraphQL errors:", result.errors);
      return NextResponse.json(
        { error: "GraphQL errors", details: result.errors },
        { status: 502 }
      );
    }

    const item = result.data?.item;
    const title = item?.title?.value ?? "";
    const content = item?.content?.value ?? "";

    return NextResponse.json({ title, content });
  } catch (error) {
    console.error("Error in page-fields API route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
