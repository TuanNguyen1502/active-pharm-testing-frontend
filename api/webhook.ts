import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    return res.status(200).end();
  }

  // Construct the webhook URL with query parameters
  const webhookBaseUrl = 'https://n8n.impactwebstudio.ca/webhook/active-pharma';
  
  // Get query parameters from request
  const queryParams = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (value) {
      queryParams.append(key, Array.isArray(value) ? value[0] : value);
    }
  });
  
  const queryString = queryParams.toString();
  const targetUrl = `${webhookBaseUrl}${queryString ? `?${queryString}` : ''}`;

  // Get auth key from environment variable
  const authKey = process.env.VITE_WEBHOOK_AUTH_KEY || process.env.WEBHOOK_AUTH_KEY;

  try {
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (authKey) {
      headers['key'] = authKey;
    }

    // Forward the request to the webhook
    const response = await fetch(targetUrl, {
      method: req.method || 'POST',
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body
        ? JSON.stringify(req.body) 
        : undefined,
    });

    // Get response data
    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data;
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    // Forward the response
    res.status(response.status).json(jsonData);
  } catch (error) {
    console.error('Webhook proxy error:', error);
    
    // Set CORS headers even on error
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.status(500).json({ 
      error: 'Failed to proxy webhook request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

