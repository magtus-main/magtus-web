// Supabase Edge Function: verify-aadhaar
// Secures Sandbox API key/secret and handles Aadhaar OTP send and verify requests.
// Natively encrypts verified Aadhaar details in profiles using sym-encryption.

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
      const { action, userId, aadhaarNumber, otp, refId } = await req.json()

      if (!action || !userId) {
        return Response.json(
          { success: false, error: 'Action and userId are required' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Initialize Supabase Admin Client
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      // Fetch user's role and full name to determine KYC completion criteria later
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        return Response.json(
          { success: false, error: 'User profile not found' },
          { status: 404, headers: corsHeaders }
        )
      }

      const isMockMode = 
        (aadhaarNumber && aadhaarNumber.startsWith('0000')) || 
        (refId && refId.startsWith('mock-'));

      // ────────────────────────────────────────────────────────
      // ACTION: GET DECRYPTED KYC (Logged-in user or Admin)
      // ────────────────────────────────────────────────────────
      if (action === 'get_decrypted_kyc') {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
          return Response.json(
            { success: false, error: 'Unauthorized' },
            { status: 200, headers: corsHeaders }
          )
        }

        const userSupabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user: authUser }, error: authError } = await userSupabase.auth.getUser()
        if (authError || !authUser) {
          return Response.json(
            { success: false, error: 'Forbidden: Authentication failed' },
            { status: 200, headers: corsHeaders }
          )
        }

        // Fetch user's own profile to check role
        const { data: callerProfile, error: callerError } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', authUser.id)
          .single()

        if (callerError || !callerProfile) {
          return Response.json(
            { success: false, error: 'Forbidden: Profile not found' },
            { status: 200, headers: corsHeaders }
          )
        }

        // Only allow if the caller is an admin, OR they are requesting their own KYC
        if (callerProfile.role !== 'admin' && authUser.id !== userId) {
          return Response.json(
            { success: false, error: 'Forbidden: You can only retrieve your own KYC details' },
            { status: 200, headers: corsHeaders }
          )
        }

        const secretKey = Deno.env.get('WHATSAPP_SECRET_SALT') || 'magtus_default_salt'

        // Fetch profile
        const { data: userProfile, error: profileErr } = await supabaseAdmin
          .from('profiles')
          .select('kyc_data, bank_data, role')
          .eq('id', userId)
          .single()

        if (profileErr || !userProfile) {
          return Response.json(
            { success: false, error: 'Profile not found' },
            { status: 200, headers: corsHeaders }
          )
        }

        let kycDecrypted = null
        if (userProfile.kyc_data) {
          const { data: plainKycText } = await supabaseAdmin.rpc('decrypt_data_sym', {
            p_encrypted_text: userProfile.kyc_data,
            p_secret_key: secretKey
          })
          if (plainKycText) {
            kycDecrypted = JSON.parse(plainKycText)
          }
        }

        let bankDecrypted = null
        if (userProfile.bank_data && userProfile.role === 'carpenter') {
          const { data: plainBankText } = await supabaseAdmin.rpc('decrypt_data_sym', {
            p_encrypted_text: userProfile.bank_data,
            p_secret_key: secretKey
          })
          if (plainBankText) {
            bankDecrypted = JSON.parse(plainBankText)
          }
        }

        return Response.json(
          {
            success: true,
            kyc: kycDecrypted,
            bank: bankDecrypted
          },
          { headers: corsHeaders }
        )
      }

      // ────────────────────────────────────────────────────────
      // ACTION: SEND OTP
      // ────────────────────────────────────────────────────────
      if (action === 'send_otp') {
        if (!aadhaarNumber || aadhaarNumber.length !== 12 || isNaN(Number(aadhaarNumber))) {
          return Response.json(
            { success: false, error: 'Valid 12-digit Aadhaar number is required' },
            { status: 200, headers: corsHeaders }
          )
        }

        if (isMockMode) {
          console.log(`[Mock Mode] Sending mock OTP for Aadhaar: ${aadhaarNumber}`);
          return Response.json(
            { success: true, refId: `mock-ref-${Date.now()}`, message: 'Mock OTP sent successfully' },
            { headers: corsHeaders }
          )
        }

        // Live Mode: Sandbox.co.in integration
        const apiKey = Deno.env.get('SANDBOX_API_KEY')
        const apiSecret = Deno.env.get('SANDBOX_API_SECRET') || Deno.env.get('SANDBOX_API_SECERET')

        if (!apiKey || !apiSecret) {
          return Response.json(
            { success: false, error: 'Sandbox API keys are not configured on Supabase' },
            { status: 200, headers: corsHeaders }
          )
        }

        // Step 1: Authenticate to Sandbox
        const authResponse = await fetch('https://api.sandbox.co.in/authenticate', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'x-api-secret': apiSecret,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })

        if (!authResponse.ok) {
          throw new Error('Sandbox authentication failed')
        }

        const authData = await authResponse.json()
        const token = authData.data?.access_token || authData.access_token

        // Step 2: Request OTP
        const otpResponse = await fetch('https://api.sandbox.co.in/kyc/aadhaar/okyc/otp', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'x-api-version': '1.0.0',
            'authorization': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ aadhaar_number: aadhaarNumber }),
        })

        const otpJson = await otpResponse.json()
        const errorDetails = otpJson.error || otpJson.data?.error

        if (errorDetails) {
          return Response.json(
            { success: false, error: errorDetails.message || 'Failed to send OTP via Sandbox' },
            { status: 200, headers: corsHeaders }
          )
        }

        const actualRefId = otpJson.data?.ref_id || otpJson.ref_id

        return Response.json(
          { success: true, refId: actualRefId, message: 'OTP sent successfully to your Aadhaar-linked mobile' },
          { headers: corsHeaders }
        )
      }

      // ────────────────────────────────────────────────────────
      // ACTION: VERIFY OTP
      // ────────────────────────────────────────────────────────
      if (action === 'verify_otp') {
        if (!otp || !refId) {
          return Response.json(
            { success: false, error: 'OTP and reference ID are required' },
            { status: 200, headers: corsHeaders }
          )
        }

        let verifiedName = ''
        let verifiedAddress = ''
        let verifiedDob = ''
        let verifiedGender = ''
        let targetAadhaar = aadhaarNumber || ''

        if (isMockMode) {
          if (otp !== '123456') {
            return Response.json(
              { success: false, error: 'Invalid mock OTP. Use 123456 for testing.' },
              { status: 200, headers: corsHeaders }
            )
          }
          verifiedName = profile?.full_name || 'Test User'
          verifiedDob = '1995-05-15'
          verifiedGender = 'Male'
          verifiedAddress = 'H.No 45, Golden Heights, Jaipur, Rajasthan - 302012'
          if (!targetAadhaar) targetAadhaar = '000012345678'
        } else {
          // Live Mode Sandbox verification
          const apiKey = Deno.env.get('SANDBOX_API_KEY')
          const apiSecret = Deno.env.get('SANDBOX_API_SECRET') || Deno.env.get('SANDBOX_API_SECERET')

          if (!apiKey || !apiSecret) {
            return Response.json(
              { success: false, error: 'Sandbox API keys are not configured' },
              { status: 200, headers: corsHeaders }
            )
          }

          // Step 1: Authenticate to Sandbox
          const authResponse = await fetch('https://api.sandbox.co.in/authenticate', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'x-api-secret': apiSecret,
              'x-api-version': '1.0.0',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          })

          if (!authResponse.ok) {
            throw new Error('Sandbox authentication failed')
          }

          const authData = await authResponse.json()
          const token = authData.data?.access_token || authData.access_token

          // Step 2: Verify OTP
          const verifyResponse = await fetch('https://api.sandbox.co.in/kyc/aadhaar/okyc/verify', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'x-api-version': '1.0.0',
              'authorization': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ otp, ref_id: refId }),
          })

          const verifyJson = await verifyResponse.json()
          const errorDetails = verifyJson.error || verifyJson.data?.error

          if (errorDetails) {
            return Response.json(
              { success: false, error: errorDetails.message || 'OTP verification failed' },
              { status: 200, headers: corsHeaders }
            )
          }

          const okycData = verifyJson.data || verifyJson
          verifiedName = okycData.name || ''
          verifiedDob = okycData.dob || ''
          verifiedGender = okycData.gender || ''

          if (typeof okycData.address === 'object') {
            const addr = okycData.address
            verifiedAddress = [
              addr.house, addr.street, addr.loc, addr.vtc, addr.dist, addr.state, addr.pc
            ].filter(Boolean).join(', ')
          } else {
            verifiedAddress = okycData.address || ''
          }
        }

        // Encrypt the Aadhaar payload before writing to profiles
        const secretKey = Deno.env.get('WHATSAPP_SECRET_SALT') || 'magtus_default_salt'
        const rawPayload = JSON.stringify({
          aadhaar_number: targetAadhaar,
          full_name: verifiedName,
          dob: verifiedDob,
          gender: verifiedGender,
          address: verifiedAddress,
          verified_at: new Date().toISOString()
        })

        const { data: encryptedData, error: encryptError } = await supabaseAdmin.rpc('encrypt_data_sym', {
          p_plain_text: rawPayload,
          p_secret_key: secretKey
        })

        if (encryptError) {
          throw new Error(`Encryption failed: ${encryptError.message}`)
        }

        // Update profile in DB
        // If the user's role is admin, dealer, or member, they ONLY need Aadhaar. Set kyc_verified = true immediately.
        // If they are a carpenter, they still need bank verification, so kyc_verified remains false.
        const isFullyVerified = profile.role !== 'carpenter';

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            aadhaar_verified: true,
            kyc_data: encryptedData,
            kyc_verified: isFullyVerified,
            full_name: verifiedName // Keep profile name synced with verified Aadhar name
          })
          .eq('id', userId)

        if (updateError) {
          throw updateError
        }

        return Response.json(
          {
            success: true,
            name: verifiedName,
            dob: verifiedDob,
            gender: verifiedGender,
            address: verifiedAddress,
            kycVerified: isFullyVerified
          },
          { headers: corsHeaders }
        )
      }

      return Response.json(
        { success: false, error: `Invalid action: ${action}` },
        { status: 200, headers: corsHeaders }
      )
    } catch (error: any) {
      console.error('verify-aadhaar error:', error)
      return Response.json(
        { success: false, error: error.message || 'Aadhaar verification error' },
        { status: 200, headers: corsHeaders }
      )
    }
  },
}
