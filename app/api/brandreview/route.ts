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
    console.log("Request body:", JSON.stringify(body, null, 2));

    const BRAND_REVIEW_API_URL = process.env.NEXT_PUBLIC_BRAND_REVIEW_API_URL || 'https://ai-skills-api-euw.sitecorecloud.io/api/skills/v1/brandreview/generate';

    const authToken = await getAuthToken();
    console.log("Auth token obtained successfully");

    const requestPayload = {
      brandkitId: body.brandkitId,
      input: {
        content: body.input?.content || ''
      },
      sections: body.sections || []
    };

    console.log("API URL:", BRAND_REVIEW_API_URL);
    console.log("Payload size:", JSON.stringify(requestPayload).length, "bytes");
    console.log("Content preview:", requestPayload.input.content.substring(0, 150));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch(BRAND_REVIEW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sc-feature': 'brandreview',
          'x-sc-interaction-type': 'generate',
          'x-sc-sellable-product': 'contenthubdam',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("Response status:", response.status);
      console.log("Response headers:", {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        transferEncoding: response.headers.get('transfer-encoding'),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        return NextResponse.json({ 
          error: `API returned ${response.status}`, 
          details: errorText 
        }, { status: response.status });
      }

      const responseText = await response.text();
      console.log("Response length:", responseText.length);
      
      if (!responseText) {
        console.warn("API returned 200 but empty body");
        return NextResponse.json({ 
          error: 'API returned empty response',
          warning: 'Status 200 but no content'
        }, { status: 502 });
      }

      const result = JSON.parse(responseText);
      console.log("Success - parsed response");
      return NextResponse.json(result);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in brandreview API route:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage
    }, { status: 500 });
  }
}