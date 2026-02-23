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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandkitId = searchParams.get('brandkitId');

    if (!brandkitId) {
      return NextResponse.json({ error: 'brandkitId is required' }, { status: 400 });
    }

    const authToken = await getAuthToken();
    console.log("Auth token obtained for sections");

    const organizationId = 'org_7ySJ52vSL4lGSd4G';
    const apiUrl = `https://ai-brands-api-euw.sitecorecloud.io/api/brands/v1/organizations/${organizationId}/brandkits/${brandkitId}/sections/`;

    console.log("Fetching sections from:", apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log("Sections API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sections API error:", errorText);
      return NextResponse.json({ error: `API returned ${response.status}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();
    console.log("Sections fetched successfully");
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in brandsections API route:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage
    }, { status: 500 });
  }
}