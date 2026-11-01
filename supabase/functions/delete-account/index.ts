// Supabase Edge Function: delete-account (Deno v2 syntax)
// Marks account status as 'deleted', clears sensitive credentials/tokens,
// revokes auth sessions and bans/deletes auth account.
//
// Deploy: npx supabase functions deploy delete-account --no-verify-jwt

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
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return Response.json(
          { success: false, error: 'Unauthorized: Missing Authorization header' },
          { status: 401, headers: corsHeaders }
        )
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

      // 1. Verify caller via their JWT session token
      const userSupabase = createClient(
        supabaseUrl,
        supabaseAnonKey,
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user: authUser }, error: authError } = await userSupabase.auth.getUser()
      if (authError || !authUser) {
        return Response.json(
          { success: false, error: 'Forbidden: Invalid or expired session' },
          { status: 403, headers: corsHeaders }
        )
      }

      const userId = authUser.id

      // 2. Initialize Supabase Admin client with service role
      const supabaseAdmin = createClient(
        supabaseUrl,
        supabaseServiceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      // 3. Mark profile status as 'deleted' and purge sensitive tokens/credentials
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          status: 'deleted',
          fcm_token: null,
          avatar_url: null,
          kyc_data: null,
          bank_data: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (profileError) {
        console.error('Failed to update profile status:', profileError)
        return Response.json(
          { success: false, error: profileError.message || 'Failed to update profile status' },
          { status: 500, headers: corsHeaders }
        )
      }

      // 4. Deactivate organization membership if member
      try {
        await supabaseAdmin
          .from('organization_members')
          .update({ is_active: false })
          .eq('member_id', userId)
      } catch (orgErr) {
        console.warn('Deactivating organization membership warning:', orgErr)
      }

      // 5. Invalidate auth sessions by banning user (immediate revocation)
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: '876600h', // 100 years
        })
      } catch (banErr) {
        console.warn('Ban user warning:', banErr)
      }

      // 6. Attempt auth user deletion if database foreign keys allow
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      } catch (delErr) {
        // Expected if profiles or orders have foreign key restrictions
        console.warn('Auth user deleteUser notice (relying on status=deleted and ban):', delErr)
      }

      return Response.json(
        { success: true, message: 'Account deleted successfully' },
        { status: 200, headers: corsHeaders }
      )
    } catch (err: any) {
      console.error('Delete account error:', err)
      return Response.json(
        { success: false, error: err.message || 'Internal server error' },
        { status: 500, headers: corsHeaders }
      )
    }
  },
}
