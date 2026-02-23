import { NextRequest, NextResponse } from 'next/server';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAuthToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const response = await fetch('https://auth.sitecorecloud.io/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SITECORE_CLIENT_ID,
        client_secret: process.env.SITECORE_CLIENT_SECRET,
        audience: 'https://api.sitecorecloud.io',
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get auth token: ${response.status}`);
    }

    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in * 1000) - 60000;

    cachedToken = {
      token: data.access_token,
      expiresAt,
    };

    return data.access_token;
  } catch (error) {
    console.error('Error fetching auth token:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Extractions API request body:", JSON.stringify(body, null, 2));

    const authToken = await getAuthToken();
    console.log("Auth token obtained for extractions");

    const apiUrl = 'https://ai-extractions-euw.sitecorecloud.io/api/extractions/v1/extractions/generate';

    console.log("Calling extractions API:", apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

    console.log("Extractions API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Extractions API error:", errorText);
      return NextResponse.json({ error: `API returned ${response.status}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();
    console.log("Extractions API success");
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in extractions API route:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage
    }, { status: 500 });
  }
}