import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { sendOperationEmail } from '../_shared/email.ts';

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(500, { error: 'Email notifications are unavailable.' });

  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: 'Sign in to request a notification.' });
  const callerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !caller) return json(401, { error: 'Your session has expired. Sign in again.' });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from('profiles').select('role,status').eq('id', caller.id).maybeSingle();
  if (profileError || !profile || profile.status !== 'ACTIVE') return json(403, { error: 'Your account cannot send notifications.' });

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json(400, { error: 'Invalid notification request.' }); }
  const type = payload.type;
  const id = typeof payload.id === 'string' ? payload.id : '';
  const requestedStatus = typeof payload.status === 'string' ? payload.status : '';
  if (!id || !['order_created', 'order_status', 'payment_created', 'payment_status', 'user_updated'].includes(String(type))) {
    return json(400, { error: 'Unsupported notification request.' });
  }

  try {
    let to = '';
    let eventKey = '';
    let subject = '';
    let heading = '';
    let message = '';

    if (type === 'user_updated') {
      if (profile.role !== 'manager') return json(403, { error: 'Only managers can notify user account changes.' });
      const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt : '';
      const { data: target, error } = await admin.from('profiles')
        .select('id,email,full_name,role,status,updated_at').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!target || !target.email) return json(404, { error: 'User account not found.' });
      if (!updatedAt || Date.parse(target.updated_at) !== Date.parse(updatedAt)) return json(409, { error: 'The user account has changed.' });
      to = target.email;
      eventKey = `user_updated:${id}:${updatedAt}`;
      subject = 'Your VFA Warehouse account was updated';
      heading = 'Account updated';
      message = `Your account details were updated. Your role is ${target.role}, and your account is ${String(target.status).toLowerCase()}.`;
    } else if (String(type).startsWith('order_')) {
      const { data: order, error } = await admin.from('orders')
        .select('id,order_number,status,customer_id,customers(name,email,user_id)')
        .eq('id', id).maybeSingle();
      if (error) throw error;
      if (!order) return json(404, { error: 'Order not found.' });
      const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
      if (!['manager', 'staff'].includes(profile.role) && customer?.user_id !== caller.id) {
        return json(403, { error: 'You cannot notify this order’s customer.' });
      }
      let email = customer?.email;
      if (!email && customer?.user_id) {
        const { data: linkedProfile } = await admin.from('profiles').select('email').eq('id', customer.user_id).maybeSingle();
        email = linkedProfile?.email;
      }
      if (!email) return json(422, { error: 'The customer has no email address.' });
      if (type === 'order_status' && requestedStatus !== order.status) return json(409, { error: 'The order status has changed.' });
      to = email;
      eventKey = type === 'order_created' ? `order_created:${id}` : `order_status:${id}:${order.status}`;
      subject = type === 'order_created' ? `Order ${order.order_number} received` : `Order ${order.order_number} update`;
      heading = type === 'order_created' ? 'Order received' : 'Order status updated';
      message = `Order ${order.order_number} is now ${String(order.status).replaceAll('_', ' ').toLowerCase()}.`;
    } else {
      const { data: payment, error } = await admin.from('payments')
        .select('id,amount,method,status,customer_id,customers(name,email,user_id),sales(invoice_number)')
        .eq('id', id).maybeSingle();
      if (error) throw error;
      if (!payment) return json(404, { error: 'Payment not found.' });
      const customer = Array.isArray(payment.customers) ? payment.customers[0] : payment.customers;
      const sale = Array.isArray(payment.sales) ? payment.sales[0] : payment.sales;
      if (!['manager', 'staff'].includes(profile.role) && customer?.user_id !== caller.id) {
        return json(403, { error: 'You cannot notify this payment’s customer.' });
      }
      let email = customer?.email;
      if (!email && customer?.user_id) {
        const { data: linkedProfile } = await admin.from('profiles').select('email').eq('id', customer.user_id).maybeSingle();
        email = linkedProfile?.email;
      }
      if (!email) return json(422, { error: 'The customer has no email address.' });
      if (type === 'payment_status' && requestedStatus !== payment.status) return json(409, { error: 'The payment status has changed.' });
      to = email;
      eventKey = type === 'payment_created' ? `payment_created:${id}` : `payment_status:${id}:${payment.status}`;
      subject = type === 'payment_created' ? 'Payment received' : 'Payment status updated';
      heading = type === 'payment_created' ? 'Payment received' : 'Payment status updated';
      message = `${payment.method} payment of ${Number(payment.amount).toLocaleString()} RWF${sale?.invoice_number ? ` for invoice ${sale.invoice_number}` : ''} is ${String(payment.status).toLowerCase()}.`;
    }

    const result = await sendOperationEmail(admin, { eventKey, to, subject, heading, message });
    return json(200, result);
  } catch (error) {
    console.error('Operation notification failed:', error);
    return json(500, { error: 'The email notification could not be sent.' });
  }
});
