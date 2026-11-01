// Supabase Edge Function: verify-bank
// Secures Sandbox API keys, performs Bank Account Penny Drop verification,
// decrypts Aadhar name to perform fuzzy matching, and sym-encrypts bank details inside profiles.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Token-based fuzzy matching to handle name order permutations or middle names
function fuzzyNameMatch(name1: string, name2: string): boolean {
  const clean = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '')
  const n1 = clean(name1)
  const n2 = clean(name2)

  if (n1 === n2) return true

  const words1 = n1.split(/\s+/)
  const words2 = n2.split(/\s+/)

  let overlap = 0
  for (const w of words1) {
    if (words2.includes(w)) overlap++
  }

  const similarity = overlap / Math.max(words1.length, words2.length)
  return similarity >= 0.5 // Accepts 50% or more overlap in name tokens
}

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    try {
      const { userId, accountNumber, ifsc } = await req.json()

      if (!userId || !accountNumber || !ifsc) {
        return Response.json(
          { success: false, error: 'UserId, accountNumber, and ifsc are required' },
          { status: 200, headers: corsHeaders }
        )
      }

      // Initialize Supabase Admin Client
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      // Fetch user profile and decrypt Aadhar name for comparison
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('aadhaar_verified, kyc_data')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        return Response.json(
          { success: false, error: 'User profile not found' },
          { status: 200, headers: corsHeaders }
        )
      }

      if (!profile.aadhaar_verified || !profile.kyc_data) {
        return Response.json(
          { success: false, error: 'Please verify your Aadhaar card first' },
          { status: 200, headers: corsHeaders }
        )
      }

      const secretKey = Deno.env.get('WHATSAPP_SECRET_SALT') || 'magtus_default_salt'

      // Decrypt Aadhaar data
      const { data: plainKycText, error: decryptError } = await supabaseAdmin.rpc('decrypt_data_sym', {
        p_encrypted_text: profile.kyc_data,
        p_secret_key: secretKey
      })

      if (decryptError || !plainKycText) {
        throw new Error('Failed to decrypt Aadhaar data for name verification')
      }

      const kycData = JSON.parse(plainKycText)
      const aadhaarName = kycData.full_name || ''

      const isMockMode = accountNumber.startsWith('0000');

      let bankHolderName = ''
      let bankName = ''
      let accountExists = false

      if (isMockMode) {
        console.log(`[Mock Mode] Performing mock bank verification for: ${accountNumber}`);
        bankHolderName = aadhaarName || 'Prabhat Suthar' // Ensure mock matches Aadhaar name
        bankName = 'State Bank of India (Mocked)'
        accountExists = true
      } else {
        // Live Mode Sandbox Penny Drop Integration
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

        // Step 2: Perform Penny Drop Account Verification
        const bankResponse = await fetch('https://api.sandbox.co.in/bank/compliance/verification/account', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'x-api-version': '1.0.0',
            'authorization': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ifsc, account_number: accountNumber }),
        })

        const bankJson = await bankResponse.json()
        const errorDetails = bankJson.error || bankJson.data?.error

        if (errorDetails) {
          return Response.json(
            { success: false, error: errorDetails.message || 'Bank account verification failed' },
            { status: 200, headers: corsHeaders }
          )
        }

        const actualBankData = bankJson.data || bankJson
        bankHolderName = actualBankData.name_at_bank || actualBankData.account_name || ''
        bankName = actualBankData.bank_name || 'Verified Bank'
        accountExists = actualBankData.account_exists !== false
      }

      if (!accountExists || !bankHolderName) {
        return Response.json(
          { success: false, error: 'Invalid or inactive bank account' },
          { status: 200, headers: corsHeaders }
        )
      }

      // Perform fuzzy name matching
      const isNameMatching = fuzzyNameMatch(aadhaarName, bankHolderName)

      if (!isNameMatching) {
        return Response.json(
          {
            success: false,
            error: `Name mismatch. Bank account holder name "${bankHolderName}" does not match Aadhaar name "${aadhaarName}".`
          },
          { status: 200, headers: corsHeaders }
        )
      }

      // Symmetrically encrypt bank details before saving
      const rawBankPayload = JSON.stringify({
        account_number: accountNumber,
        ifsc: ifsc.toUpperCase(),
        bank_name: bankName,
        bank_holder_name: bankHolderName,
        verified_at: new Date().toISOString()
      })

      const { data: encryptedBankData, error: encryptError } = await supabaseAdmin.rpc('encrypt_data_sym', {
        p_plain_text: rawBankPayload,
        p_secret_key: secretKey
      })

      if (encryptError) {
        throw new Error(`Encryption failed: ${encryptError.message}`)
      }

      // Update database profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          bank_verified: true,
          bank_data: encryptedBankData,
          kyc_verified: true // Once bank is verified, Carpenter's overall KYC is fully verified!
        })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      return Response.json(
        {
          success: true,
          bankName,
          bankHolderName,
          kycVerified: true
        },
        { headers: corsHeaders }
      )
    } catch (error: any) {
      console.error('verify-bank error:', error)
      return Response.json(
        { success: false, error: error.message || 'Bank verification error' },
        { status: 200, headers: corsHeaders }
      )
    }
  },
}
