// Supabase Edge Function: verify-otp (Deno v2 syntax)
// Verifies HMAC-signed OTP, creates/finds user via Supabase Admin, returns session
//
// Deploy: npx supabase functions deploy verify-otp --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    try {
      const { phone, otp, otpHash } = await req.json()

      if (!phone || !otp || !otpHash) {
        return Response.json(
          { success: false, error: 'Phone, OTP, and hash required' },
          { status: 400, headers: corsHeaders }
        )
      }

      const SECRET_SALT = Deno.env.get('WHATSAPP_SECRET_SALT') || 'magtus_default_salt'

      // Parse hash: "cleanPhone:expiry:signature"
      const parts = otpHash.split(':')
      if (parts.length !== 3) {
        return Response.json(
          { success: false, error: 'Invalid verification data' },
          { status: 400, headers: corsHeaders }
        )
      }

      const [hashPhone, exp, receivedSignature] = parts

      // Check expiry
      if (Date.now() > parseInt(exp)) {
        return Response.json(
          { success: false, error: 'OTP expired. Please request a new one.' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Clean phone
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

      // Hardcoded test phone numbers (kept for testing reference)
      const testNumbers = [
        '9876543210', '9876543211', // admin
        '9876543212', '9876543213', // dealer
        '9876543214', '9876543215', // member (admin's staff)
        '9876543216', '9876543217', // carpenter
        '9876543218', '9876543219', // staff (dealer's staff)
      ]

      if (cleanPhone !== hashPhone) {
        return Response.json(
          { success: false, error: 'Phone number mismatch' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Verify HMAC using Web Crypto API
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
      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      if (receivedSignature !== expectedSignature) {
        return Response.json(
          { success: false, error: 'Invalid OTP' },
          { status: 400, headers: corsHeaders }
        )
      }

      // ✅ OTP verified! Create/find user via Supabase Admin
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const fakeEmail = `${cleanPhone}@magtus.app`

      // Check if user exists
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers()
      let existingUser = userList?.users?.find((u: any) => u.email === fakeEmail)

      let userId: string
      let isNewUser = false

      if (existingUser) {
        userId = existingUser.id
      } else {
        // Create new user
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: fakeEmail,
            email_confirm: true,
            phone: `+91${cleanPhone}`,
            phone_confirm: true,
            user_metadata: { phone: cleanPhone },
          })

        if (createError) throw createError
        userId = newUser.user.id
        isNewUser = true
      }

      // Generate magic link for client-side session
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: fakeEmail,
        })

      if (linkError) throw linkError

      // Check if profile exists and status
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, status')
        .eq('id', userId)
        .maybeSingle()

      if (profile && (profile.status === 'suspended' || profile.status === 'deleted')) {
        return Response.json(
          {
            success: false,
            error:
              profile.status === 'deleted'
                ? 'This account has been deleted. Please contact support if you need assistance.'
                : 'Account is blocked, contact admin.',
          },
          { status: 403, headers: corsHeaders }
        )
      }

      return Response.json(
        {
          success: true,
          isNewUser: isNewUser || !profile,
          email: fakeEmail,
          token_hash: linkData?.properties?.hashed_token,
        },
        { headers: corsHeaders }
      )
    } catch (error: any) {
      console.error('verify-otp error:', error)
      return Response.json(
        { success: false, error: error.message || 'Verification failed' },
        { status: 500, headers: corsHeaders }
      )
    }
  },
}
