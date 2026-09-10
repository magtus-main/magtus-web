/**
 * Frontend Permission Utilities for Magtus Web Admin
 */

/**
 * Checks if a user has permission for a specific module and action.
 * @param {object} profile - The user profile
 * @param {object} orgMember - The organization member record
 * @param {string} module - The module name ('qrcodes', 'users', 'redemptions', 'orders', 'team', etc.)
 * @param {string} action - The action ('view' or 'edit')
 * @returns {boolean}
 */
export function hasModulePermission(profile, orgMember, module, action = 'view') {
  if (!profile) return false;
  
  // Super Admins have full access to everything
  if (profile.role === 'admin') return true;
  
  // If not super admin and not a member, no admin portal access
  if (profile.role !== 'member') return false;
  if (!orgMember) return false;
  
  // Owner role has full access
  if (orgMember.role_name === 'Owner') return true;

  const perms = orgMember.permissions || {};
  
  // Full access level
  if (perms.access_level === 'full') return true;
  
  // Partial access level - check module maps
  if (perms.access_level === 'partial') {
    return !!perms.modules?.[module]?.[action];
  }
  
  return false;
}

/**
 * Checks if a user has permission to perform a specific order step (admin side only).
 * @param {object} profile - The user profile
 * @param {object} orgMember - The organization member record
 * @param {string} step - The transition step ('confirm', 'ship', 'deliver', 'cancel')
 * @returns {boolean}
 */
export function hasOrderStepPermission(profile, orgMember, step) {
  if (!profile) return false;
  
  // Super Admins can perform any step
  if (profile.role === 'admin') return true;
  
  // If not super admin and not a member, no admin portal access
  if (profile.role !== 'member') return false;
  if (!orgMember) return false;
  
  // Owner role has full access
  if (orgMember.role_name === 'Owner') return true;

  const perms = orgMember.permissions || {};
  
  // Full access level
  if (perms.access_level === 'full') return true;

  // Must have orders.edit permission first
  if (!perms.modules?.orders?.edit) return false;

  // Check specific order step
  return !!perms.order_steps?.[step];
}

/**
 * Standard default permissions JSON structure for new invites/members
 */
export const DEFAULT_ADMIN_PERMISSIONS = {
  access_level: 'partial',
  modules: {
    qrcodes: { view: true, edit: false },
    users: { view: true, edit: false },
    redemptions: { view: true, edit: false },
    orders: { view: true, edit: false },
    team: { view: true, edit: false },
    products: { view: true, edit: false }
  },
  order_steps: {
    confirm: false,
    ship: false,
    deliver: false,
    cancel: false
  }
};

/**
 * Server-side route authorization check.
 * Verifies if the logged-in user is authorized to access the page.
 * @param {object} supabase - The supabase server client
 * @param {string} module - The module to check
 * @param {string} action - The action ('view' or 'edit')
 * @returns {Promise<{profile: object, orgMember: object|null}>}
 */
export async function verifyServerPageAccess(supabase, module, action = 'view') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { redirect } = require("next/navigation");
    redirect('/magtus-login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const { redirect } = require("next/navigation");
    redirect('/magtus-login');
  }

  let orgMember = null;
  if (profile.role === 'member') {
    const { data } = await supabase
      .from('organization_members')
      .select('*')
      .eq('member_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    orgMember = data;
  }

  if (!hasModulePermission(profile, orgMember, module, action)) {
    const { redirect } = require("next/navigation");
    redirect('/dashboard');
  }

  return { profile, orgMember };
}
