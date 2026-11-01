// Supabase Edge Function: verify-gst (Deno v2 syntax)
// Authenticates with Sandbox.co.in and verifies GSTIN securely on the server
//
// Deploy: npx supabase functions deploy verify-gst --no-verify-jwt
// Secrets: npx supabase secrets set SANDBOX_API_KEY=... SANDBOX_API_SECRET=...

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const { gst } = await req.json().catch(() => ({}));
      const formattedGst = (gst || '').toString().trim().toUpperCase();

      if (!formattedGst || formattedGst.length !== 15) {
        return Response.json(
          { success: false, error: 'Valid 15-character GST number required' },
          { status: 400, headers: corsHeaders }
        );
      }

      const apiKey = Deno.env.get('SANDBOX_API_KEY') || Deno.env.get('EXPO_PUBLIC_SANDBOX_API_KEY');
      const apiSecret =
        Deno.env.get('SANDBOX_API_SECRET') ||
        Deno.env.get('SANDBOX_API_SECERET') ||
        Deno.env.get('EXPO_PUBLIC_SANDBOX_API_SECRET') ||
        Deno.env.get('EXPO_PUBLIC_SANDBOX_API_SECERET');

      if (!apiKey || !apiSecret) {
        console.error('[verify-gst] Missing SANDBOX_API_KEY or SANDBOX_API_SECRET');
        return Response.json(
          {
            success: false,
            error: 'GST verification service is not configured. Please set SANDBOX_API_KEY and SANDBOX_API_SECRET in Supabase secrets.',
          },
          { status: 500, headers: corsHeaders }
        );
      }

      // Step 1: Authenticate with Sandbox.co.in to get Bearer token
      const authResponse = await fetch('https://api.sandbox.co.in/authenticate', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret,
          'x-api-version': '1.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!authResponse.ok) {
        const errText = await authResponse.text();
        console.error('[verify-gst] Sandbox Auth Failed:', errText);
        return Response.json(
          { success: false, error: 'Failed to authenticate with GST verification service' },
          { status: 502, headers: corsHeaders }
        );
      }

      const authData = await authResponse.json();
      const token = authData.data?.access_token || authData.access_token;

      if (!token) {
        return Response.json(
          { success: false, error: 'Invalid response from GST verification service' },
          { status: 502, headers: corsHeaders }
        );
      }

      // Step 2: Search GSTIN details
      const gstResponse = await fetch('https://api.sandbox.co.in/gst/compliance/public/gstin/search', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'x-api-version': '1.0.0',
          'authorization': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gstin: formattedGst }),
      });

      if (!gstResponse.ok) {
        const errText = await gstResponse.text();
        console.error('[verify-gst] GST Search Error:', errText);
        return Response.json(
          { success: false, error: 'GST number not found or verification service temporarily unavailable.' },
          { status: 404, headers: corsHeaders }
        );
      }

      const responseJson = await gstResponse.json();
      const gstData = responseJson.data?.data || responseJson.data || responseJson;

      if (!gstData || (!gstData.lgnm && !gstData.tradeNam)) {
        return Response.json(
          { success: false, error: 'No business records found for this GSTIN' },
          { status: 404, headers: corsHeaders }
        );
      }

      const addr = gstData.pradr?.addr;
      const addressString = [
        addr?.bno,
        addr?.bnm,
        addr?.flno,
        addr?.st,
        addr?.loc,
      ]
        .filter(Boolean)
        .join(', ');

      return Response.json(
        {
          success: true,
          legal_name: gstData.lgnm || gstData.tradeNam || '',
          trade_name: gstData.tradeNam || gstData.lgnm || '',
          status: gstData.sts || 'Active',
          address: addressString || undefined,
          city: addr?.loc || addr?.dst || '',
          state: addr?.stcd || '',
          pincode: addr?.pncd || '',
        },
        { headers: corsHeaders }
      );
    } catch (err: any) {
      console.error('[verify-gst] Server error:', err);
      return Response.json(
        { success: false, error: err.message || 'GST verification failed' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

