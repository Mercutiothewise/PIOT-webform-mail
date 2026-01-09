const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getBaseUrl(req) {
  const host = req.headers.host || req.headers['x-forwarded-host'];
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  return process.env.BASE_URL || `${protocol}://${host}`;
}

function parseBody(body, contentType) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try {
    if (contentType && contentType.includes('application/json')) {
      return JSON.parse(body);
    } else {
      const params = new URLSearchParams(body);
      const result = {};
      for (const [key, value] of params) {
        result[key] = value;
      }
      return result;
    }
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url.split('?')[0];
  const method = req.method;

  // ROOT
  if (url === '/' && method === 'GET') {
    return res.status(200).json({
      status: 'PUREIOT Support API is running',
      version: '3.0.0'
    });
  }

  // UPDATE FORM (GET)
  if (url.startsWith('/update/') && method === 'GET') {
    const ticketId = url.replace('/update/', '');
    
    const { data: ticket } = await supabase
      .from('tickets')
      .select('*, user:profiles(first_name, surname), company:companies(name)')
      .eq('id', ticketId)
      .single();

    if (!ticket) {
      return res.status(404).send('<h1>Ticket Not Found</h1>');
    }

    const userName = `${ticket.user?.first_name || ''} ${ticket.user?.surname || ''}`.trim();
    const companyName = ticket.company?.name || 'Unknown';
    const technicians = ['Jeandre', 'Dekel', 'Rob', 'Aiden', 'Jakes', 'Jaco', 'Norman', 'Karabo'];
    const statuses = ['unassigned', 'assigned', 'in-progress', 'completed'];

    const statusOptions = statuses.map(s => 
      `<option value="${s}" ${ticket.status === s ? 'selected' : ''}>${s}</option>`
    ).join('');
    
    const techOptions = ['', ...technicians].map(t => 
      `<option value="${t}" ${ticket.technician_name === t ? 'selected' : ''}>${t || '-- Select --'}</option>`
    ).join('');

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Update ${ticket.ticket_number}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>body{font-family:sans-serif;max-width:500px;margin:40px auto;padding:20px}
      .form-group{margin:15px 0}label{display:block;margin-bottom:5px;font-weight:bold}
      select,textarea{width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;font-size:16px}
      button{background:#6528F7;color:white;padding:15px 30px;border:none;border-radius:8px;font-size:16px;cursor:pointer;width:100%}
      .info{background:#f5f5f5;padding:15px;border-radius:8px;margin-bottom:20px}</style>
      </head>
      <body>
      <h1>🎫 Update Ticket</h1>
      <p><strong>${ticket.ticket_number}</strong></p>
      <div class="info">
        <p><strong>${ticket.subject}</strong></p>
        <p>Company: ${companyName}</p>
        <p>User: ${userName}</p>
        <p>Status: ${ticket.status}</p>
      </div>
      <form method="POST">
        <div class="form-group"><label>Status</label><select name="status">${statusOptions}</select></div>
        <div class="form-group"><label>Technician</label><select name="technicianName">${techOptions}</select></div>
        <div class="form-group"><label>Note</label><textarea name="note" rows="3"></textarea></div>
        <button type="submit">✅ Update Ticket</button>
      </form>
      </body></html>
    `);
  }

  // UPDATE FORM (POST)
  if (url.startsWith('/update/') && method === 'POST') {
    const ticketId = url.replace('/update/', '');
    const body = parseBody(req.body, req.headers['content-type']);
    const { status, technicianName, note } = body;

    await supabase.from('tickets').update({
      status,
      technician_name: technicianName || null,
      updated_at: new Date().toISOString()
    }).eq('id', ticketId);

    if (note && note.trim()) {
      await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        author_name: technicianName || 'Support Team',
        text: note.trim(),
        is_from_user: false
      });
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html><head><title>Updated</title>
      <style>body{font-family:sans-serif;text-align:center;padding:50px}</style>
      </head><body>
      <h1>✅ Ticket Updated!</h1>
      <p>Status: <strong>${status}</strong></p>
      <p><a href="/update/${ticketId}">← Back</a></p>
      </body></html>
    `);
  }

  // SUBMIT TICKET
  if (url === '/api/submit-ticket' && method === 'POST') {
    try {
      const { ticket, user } = req.body;
      if (!ticket || !user) {
        return res.status(400).json({ success: false, message: 'Missing data' });
      }

      const { subject, description, priority, contactPreference, scheduledTime } = ticket;
      const { firstName, surname, email, phone, companyName, anyDeskId } = user;
      const ticketNumber = `PIOT-${Date.now().toString(36).toUpperCase()}`;

      const { data: company } = await supabase.from('companies').select('id').eq('name', companyName).single();
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single();

      const { data: newTicket, error } = await supabase.from('tickets').insert({
        ticket_number: ticketNumber,
        subject,
        description,
        priority: priority || 'medium',
        status: 'unassigned',
        user_id: profile?.id,
        company_id: company?.id,
        contact_preference: contactPreference || 'asap',
        scheduled_time: scheduledTime || null
      }).select().single();

      if (error) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      const baseUrl = getBaseUrl(req);
      const updateUrl = `${baseUrl}/update/${newTicket.id}`;
      const contactDisplay = contactPreference === 'scheduled' && scheduledTime 
        ? `Scheduled: ${new Date(scheduledTime).toLocaleString('en-ZA')}`
        : 'ASAP';

      const emailHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#6528F7;color:white;padding:20px;text-align:center">
            <h1>🎫 New Ticket: ${ticketNumber}</h1>
          </div>
          <div style="padding:20px">
            <p><strong>Priority:</strong> ${(priority || 'medium').toUpperCase()}</p>
            <p><strong>Contact:</strong> ${contactDisplay}</p>
            <p><a href="${updateUrl}" style="display:inline-block;background:#6528F7;color:white;padding:15px 30px;text-decoration:none;border-radius:8px">📝 Update Ticket</a></p>
            <hr>
            <h2>${subject}</h2>
            <p>${description}</p>
            <hr>
            <p><strong>User:</strong> ${firstName} ${surname}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>AnyDesk:</strong> ${anyDeskId}</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.SUPPORT_EMAIL || 'michael@piot.co.za',
        subject: `[${ticketNumber}] ${companyName} - ${firstName} ${surname}`,
        html: emailHtml,
        replyTo: email
      });

      return res.status(200).json({ success: true, ticketId: newTicket.id, ticketNumber });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // GET USER TICKETS
  if (url.startsWith('/api/tickets/') && method === 'GET') {
    const userId = url.replace('/api/tickets/', '');
    const { data: tickets } = await supabase.from('tickets').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return res.status(200).json({ success: true, tickets: tickets || [] });
  }

  // GET SINGLE TICKET
  if (url.startsWith('/api/ticket/') && method === 'GET') {
    const ticketId = url.replace('/api/ticket/', '');
    const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).single();
    if (!ticket) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, ticket });
  }

  // 404
  return res.status(404).json({ error: 'Not found', url, method });
};
