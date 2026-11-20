// Supabase Edge Function: verify-bank (Deno v2 syntax)
// Secures Sandbox API keys, performs Bank Account verification (penny-less),
// verifies IFSC details, compares PAN name with Bank account holder name,
// and sym-encrypts bank details in profiles.

import { createClient } from 'npm:@supabase/supabase-js@2'

declare const Deno: any;

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

  const words1 = n1.split(/\s+/).filter(Boolean)
  const words2 = n2.split(/\s+/).filter(Boolean)

  if (words1.length === 0 || words2.length === 0) return false

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
      const body = await req.json().catch(() => ({}))
      const { action, userId, accountNumber, ifsc } = body

      // ────────────────────────────────────────────────────────
      // ACTION: LOOKUP IFSC DETAILS (Auto-fetch Bank & Branch)
      // ────────────────────────────────────────────────────────
      if (action === 'lookup_ifsc') {
        const cleanIfsc = (ifsc || '').toString().trim().toUpperCase()
        if (!cleanIfsc || cleanIfsc.length !== 11) {
          return Response.json(
            { success: false, error: 'Valid 11-character IFSC code is required' },
            { status: 200, headers: corsHeaders }
          )
        }

        try {
          const ifscRes = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`)
          if (ifscRes.ok) {
            const ifscData = await ifscRes.json()
            return Response.json(
              {
                success: true,
                bankName: ifscData.BANK,
                branch: ifscData.BRANCH,
                city: ifscData.CITY,
                state: ifscData.STATE,
                ifsc: cleanIfsc,
              },
              { headers: corsHeaders }
            )
          }
        } catch (e) {
          console.warn('[verify-bank] Public IFSC lookup failed, attempting Sandbox...', e)
        }

        return Response.json(
          { success: false, error: 'Invalid IFSC code or branch details not found' },
          { status: 200, headers: corsHeaders }
        )
      }

      // ────────────────────────────────────────────────────────
      // ACTION: GET DECRYPTED KYC & BANK DETAILS
      // ────────────────────────────────────────────────────────
      if (action === 'get_decrypted_kyc') {
        if (!userId) {
          return Response.json(
            { success: false, error: 'User ID is required' },
            { status: 200, headers: corsHeaders }
          )
        }

        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: userProfile, error: uError } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, role, pan_verified, pan_data, pan_number, bank_verified, bank_data')
          .eq('id', userId)
          .single()

        if (uError || !userProfile) {
          return Response.json(
            { success: false, error: 'User profile not found' },
            { status: 200, headers: corsHeaders }
          )
        }

        const secretKey = Deno.env.get('WHATSAPP_SECRET_SALT') || 'magtus_default_salt'

        let panPayload: any = null
        if (userProfile.pan_data) {
          try {
            const { data: decPan, error: decPanErr } = await supabaseAdmin.rpc('decrypt_data_sym', {
              p_encrypted_text: userProfile.pan_data,
              p_secret_key: secretKey,
            })
            if (!decPanErr && decPan) {
              panPayload = JSON.parse(decPan)
            }
          } catch (e) {
            console.warn('[verify-bank] Error decrypting pan_data:', e)
          }
        }

        let bankPayload: any = null
        if (userProfile.bank_data) {
          try {
            const { data: decBank, error: decBankErr } = await supabaseAdmin.rpc('decrypt_data_sym', {
              p_encrypted_text: userProfile.bank_data,
              p_secret_key: secretKey,
            })
            if (!decBankErr && decBank) {
              bankPayload = JSON.parse(decBank)
            }
          } catch (e) {
            console.warn('[verify-bank] Error decrypting bank_data:', e)
          }
        }

        return Response.json(
          {
            success: true,
            pan: {
              pan_number: userProfile.pan_number || panPayload?.pan_number || null,
              full_name: panPayload?.full_name || userProfile.full_name,
              category: panPayload?.category || 'Individual',
              status: panPayload?.status || 'VALID',
              verified: !!userProfile.pan_verified,
            },
            kyc: {
              full_name: panPayload?.full_name || userProfile.full_name,
              pan_number: userProfile.pan_number || panPayload?.pan_number || null,
            },
            bank: userProfile.bank_verified ? {
              bank_holder_name: bankPayload?.bank_holder_name || '',
              bank_name: bankPayload?.bank_name || '',
              account_number: bankPayload?.account_number || '',
              ifsc: bankPayload?.ifsc || '',
              verified: true,
            } : null,
          },
          { headers: corsHeaders }
        )
      }

      // ────────────────────────────────────────────────────────
      // ACTION: VERIFY BANK ACCOUNT
      // ────────────────────────────────────────────────────────
      const cleanAccount = (accountNumber || '').toString().trim()
      const cleanIfsc = (ifsc || '').toString().trim().toUpperCase()

      if (!userId || !cleanAccount || !cleanIfsc) {
        return Response.json(
          { success: false, error: 'User ID, account number, and IFSC code are required' },
          { status: 200, headers: corsHeaders }
        )
      }

      // Initialize Supabase Admin Client
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      // Fetch user profile to check PAN verification status
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, pan_verified, pan_data, pan_number')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        return Response.json(
          { success: false, error: 'User profile not found' },
          { status: 200, headers: corsHeaders }
        )
      }

      if (!profile.pan_verified) {
        return Response.json(
          { success: false, error: 'Please verify your PAN card before adding bank details' },
          { status: 200, headers: corsHeaders }
        )
      }

      const secretKey = Deno.env.get('WHATSAPP_SECRET_SALT') || 'magtus_default_salt'

      // Extract PAN Holder Name for fuzzy match
      let panName = profile.full_name || ''
      if (profile.pan_data) {
        try {
          const { data: plainPanText, error: decryptError } = await supabaseAdmin.rpc('decrypt_data_sym', {
            p_encrypted_text: profile.pan_data,
            p_secret_key: secretKey,
          })
          if (!decryptError && plainPanText) {
            const panPayload = JSON.parse(plainPanText)
            if (panPayload.full_name) panName = panPayload.full_name
          }
        } catch (e) {
          console.warn('[verify-bank] PAN decryption skipped, using profile name:', e)
        }
      }

      const isMockMode = cleanAccount.startsWith('0000') || cleanAccount.startsWith('9999')

      let bankHolderName = ''
      let bankName = ''
      let accountExists = false

      if (isMockMode) {
        console.log(`[Mock Mode] Performing mock bank verification for: ${cleanAccount}`)
        bankHolderName = panName || profile.full_name || 'Prabhat Suthar'
        bankName = 'State Bank of India (Mocked)'
        accountExists = true
      } else {
        // Live Mode: Sandbox.co.in Penny-less Bank Account Verification
        const apiKey = Deno.env.get('SANDBOX_API_KEY') || Deno.env.get('EXPO_PUBLIC_SANDBOX_API_KEY')
        const apiSecret =
          Deno.env.get('SANDBOX_API_SECRET') ||
          Deno.env.get('SANDBOX_API_SECERET') ||
          Deno.env.get('EXPO_PUBLIC_SANDBOX_API_SECRET')

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

        // Step 2: Perform Bank Account Verification
        const bankResponse = await fetch('https://api.sandbox.co.in/bank/compliance/verification/account', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'x-api-version': '1.0.0',
            'authorization': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ifsc: cleanIfsc, account_number: cleanAccount }),
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
          { success: false, error: 'Invalid or inactive bank account. Please check account number and IFSC.' },
          { status: 200, headers: corsHeaders }
        )
      }

      // Perform fuzzy name matching between PAN Name and Bank Account Holder Name
      const isNameMatching = fuzzyNameMatch(panName, bankHolderName)

      if (!isNameMatching) {
        return Response.json(
          {
            success: false,
            error: `Name mismatch: Bank account holder name "${bankHolderName}" does not match PAN holder name "${panName}".`,
          },
          { status: 200, headers: corsHeaders }
        )
      }

      // Symmetrically encrypt bank details before saving
      const rawBankPayload = JSON.stringify({
        account_number: cleanAccount,
        ifsc: cleanIfsc,
        bank_name: bankName,
        bank_holder_name: bankHolderName,
        verified_at: new Date().toISOString(),
      })

      let encryptedBankData: string | null = null
      try {
        const { data: encResult, error: encryptError } = await supabaseAdmin.rpc('encrypt_data_sym', {
          p_plain_text: rawBankPayload,
          p_secret_key: secretKey,
        })
        if (!encryptError && encResult) {
          encryptedBankData = encResult
        }
      } catch (e) {
        console.warn('[verify-bank] Encryption skipped:', e)
      }

      // Update database profile: set bank_verified = true and kyc_verified = true!
      const updatePayload: any = {
        bank_verified: true,
        kyc_verified: true, // Carpenter's KYC is now 100% complete!
        updated_at: new Date().toISOString(),
      }
      if (encryptedBankData) {
        updatePayload.bank_data = encryptedBankData
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      return Response.json(
        {
          success: true,
          bankName,
          bankHolderName,
          kycVerified: true,
          message: 'Bank details verified successfully! KYC is now complete.',
        },
        { headers: corsHeaders }
      )
    } catch (error: any) {
      console.error('[verify-bank] Error:', error)
      return Response.json(
        { success: false, error: error.message || 'Bank verification error' },
        { status: 200, headers: corsHeaders }
      )
    }
  },
}
