// Supabase Edge Function: send-otp (Deno v2 syntax)
// Generates OTP, sends via Meta WhatsApp Cloud API, returns HMAC hash
//
// Deploy: npx supabase functions deploy send-otp --no-verify-jwt
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default {
  async fetch(req: Request) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    try {
      const { phone } = await req.json()

      // Clean phone: strip non-digits and leading country code '91'
      let cleanPhone = (phone || '').toString().replace(/\D/g, '')
      if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
        cleanPhone = cleanPhone.substring(2)
      }

      if (!cleanPhone || cleanPhone.length !== 10) {
        return Response.json(
          { success: false, error: 'Valid 10-digit phone number required' },
          { status: 400, headers: corsHeaders }
        )
      }

      const SECRET_SALT = Deno.env.get('WHATSAPP_SECRET_SALT') || 'magtus_default_salt'

      // Hardcoded test phone numbers bypass (uses static OTP: 000000)
      const testNumbers = [
        '9876543210', '9876543211', // admin
        '9876543212', '9876543213', // dealer
        '9876543214', '9876543215', // member (admin's staff)
        '9876543216', '9876543217', // carpenter
        '9876543218', '9876543219', // staff (dealer's staff)
      ]

      const isTestNumber = testNumbers.includes(cleanPhone)
      let otp: string
      const exp = Date.now() + 10 * 60 * 1000 // 10 minutes validity

      if (isTestNumber) {
        // Test bypass: static OTP 000000 — no WhatsApp message sent
        otp = '000000'
        console.log(`[Test Bypass] OTP '000000' applied for test number: ${cleanPhone}`)
      } else {
        // Generate secure random 6-digit OTP
        otp = Math.floor(100000 + Math.random() * 900000).toString()

        // Meta WhatsApp Cloud API credentials
        const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || Deno.env.get('META_WHATSAPP_TOKEN')
        const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
        const templateName = Deno.env.get('WHATSAPP_TEMPLATE_NAME') || 'magtus_otp'
        const templateLang = Deno.env.get('WHATSAPP_TEMPLATE_LANG') || 'en'
        const apiVersion = Deno.env.get('WHATSAPP_API_VERSION') || 'v21.0'
        const buttonType = Deno.env.get('WHATSAPP_BUTTON_TYPE') || 'none' // 'none', 'url', or 'copy_code'

        if (!accessToken || !phoneNumberId) {
          console.error('[send-otp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID')
          return Response.json(
            {
              success: false,
              error: 'WhatsApp service is not configured. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Supabase secrets.',
            },
            { status: 500, headers: corsHeaders }
          )
        }

        // Prepare components for Meta WhatsApp Cloud API template
        const components: any[] = [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: otp,
              },
            ],
          },
        ]

        // Add button component if the template is configured with one
        if (buttonType === 'url') {
          components.push({
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: otp,
              },
            ],
          })
        } else if (buttonType === 'copy_code') {
          components.push({
            type: 'button',
            sub_type: 'copy_code',
            index: '0',
            parameters: [
              {
                type: 'coupon_code',
                coupon_code: otp,
              },
            ],
          })
        }

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: `91${cleanPhone}`,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: templateLang,
            },
            components,
          },
        }

        console.log(`[send-otp] Sending WhatsApp OTP to 91${cleanPhone} via Meta Cloud API (template: ${templateName})`)

        const metaUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
        const response = await fetch(metaUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const resData = await response.json().catch(() => null)

        if (!response.ok || resData?.error) {
          const errMsg =
            resData?.error?.message ||
            resData?.error?.error_data?.details ||
            `HTTP ${response.status}: ${response.statusText}`
          console.error('[send-otp] Meta WhatsApp Cloud API error:', JSON.stringify(resData || response.statusText))
          return Response.json(
            { success: false, error: `WhatsApp OTP delivery failed: ${errMsg}` },
            { status: 502, headers: corsHeaders }
          )
        }

        console.log(`[send-otp] Meta WhatsApp OTP message dispatched successfully to 91${cleanPhone} (ID: ${resData?.messages?.[0]?.id})`)
      }

      // HMAC hash using Web Crypto API (built into Deno v2)
      const encoder = new TextEncoder()
      const dataToSign = `${cleanPhone}:${otp}:${exp}`
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(SECRET_SALT),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign))
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      const otpHash = `${cleanPhone}:${exp}:${signature}`

      return Response.json(
        { success: true, otpHash },
        { headers: corsHeaders }
      )
    } catch (error: any) {
      console.error('send-otp error:', error)
      return Response.json(
        { success: false, error: error.message || 'Failed to send OTP' },
        { status: 500, headers: corsHeaders }
      )
    }
  },
}
