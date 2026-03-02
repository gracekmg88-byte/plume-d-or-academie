import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // --- Authentication: require a valid logged-in admin ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerId = claimsData.claims.sub as string

    // Check caller is admin using service role client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: roleCheck } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- Validated admin caller, proceed ---
    const { email, password } = await req.json()

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string' || password.length < 8) {
      return new Response(JSON.stringify({ error: 'Invalid input: email and password (min 8 chars) required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create user
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createError) {
      if (createError.message.includes('already been registered')) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        if (listError) throw listError

        const existingUser = users.find(u => u.email === email)
        if (existingUser) {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password })

          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: existingUser.id, role: 'admin' }, { onConflict: 'user_id,role' })

          if (roleError) console.error('Role error:', roleError)

          return new Response(JSON.stringify({ success: true, userId: existingUser.id, message: 'User updated with admin role' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
      throw createError
    }

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userData.user.id, role: 'admin' })

    if (roleError) console.error('Role insert error:', roleError)

    return new Response(JSON.stringify({ success: true, userId: userData.user.id, message: 'Admin created successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
