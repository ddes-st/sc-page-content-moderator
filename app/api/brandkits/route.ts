import { NextRequest, NextResponse } from 'next/server';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAuthToken() {
  // Check if cached token is still valid
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

export async function GET(request: NextRequest) {
  try {
    const authToken = await getAuthToken();
    const BRANDKITS_API_URL = 'https://ai-brands-api-euw.sitecorecloud.io/api/brands/v1/organizations/org_7ySJ52vSL4lGSd4G/brandkits/';

    const response = await fetch(BRANDKITS_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const errorText = await response.text();
      return NextResponse.json({ error: `${response.status} ${response.statusText} - ${errorText}` }, { status: response.status });
    }
  } catch (error) {
    console.error('Error in brandkits API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}