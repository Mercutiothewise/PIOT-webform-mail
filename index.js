const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  return process.env.BASE_URL || `https://${req.headers.host}`;
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'PUREIOT Support API is running',
    version: '3.0.0',
    endpoints: {
      submitTicket: 'POST /api/submit-ticket',
      getTickets: 'GET /api/tickets/:userId',
      updateTicket: 'GET /update/:ticketId',
    }
  });
});

// Ticket update form (GET)
app.get('/update/:ticketId', async (req, res) => {
  const { ticketId } = req.params;

  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      *,
      user:profiles(first_name, surname),
      company:companies(name)
    `)
    .eq('id', ticketId)
    .single();

  if (!ticket) {
    return res.status(404).send(`
      <html>
        <head>
          <title>Ticket Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; background: #f8f9fa; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            h1 { color: #dc3545; }
            p { color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Ticket Not Found</h1>
            <p>Ticket ID <strong>${ticketId}</strong> was not found.</p>
          </div>
        </body>
      </html>
    `);
  }

  const userName = `${ticket.user?.first_name || ''} ${ticket.user?.surname || ''}`.trim();
  const companyName = ticket.company?.name || 'Unknown';

  const technicians = ['Jeandre', 'Dekel', 'Rob', 'Aiden', 'Jakes', 'Jaco', 'Norman', 'Karabo'];
  const statuses = [
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' }
  ];
  
  const statusOptions = statuses.map(s => 
    `<option value="${s.value}" ${ticket.status === s.value ? 'selected' : ''}>${s.label}</option>`
  ).join('');
  
  const technicianOptions = ['', ...technicians].map(t => 
    `<option value="${t}" ${ticket.technician_name === t ? 'selected' : ''}>${t || '-- Select Technician --'}</option>`
  ).join('');

  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <html>
      <head>
        <title>Update Ticket ${ticket.ticket_number}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; 
            margin: 0;
            padding: 20px;
          }
          .container { 
            background: white; 
            padding: 30px; 
            border-radius: 16px; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.2); 
            max-width: 500px; 
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
          }
          .logo { font-size: 32px; margin-bottom: 10px; }
          h1 { color: #6528F7; margin: 0 0 5px 0; font-size: 22px; }
          .ticket-id { color: #6c757d; font-size: 14px; font-family: monospace; background: #f8f9fa; padding: 5px 10px; border-radius: 4px; display: inline-block; }
          .ticket-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .ticket-info h3 { margin: 0 0 10px 0; color: #333; font-size: 16px; }
          .ticket-info p { margin: 5px 0; color: #666; font-size: 14px; }
          .ticket-info .label { color: #999; }
          .form-group { margin-bottom: 20px; }
          label { display: block; margin-bottom: 8px; color: #333; font-weight: 600; font-size: 14px; }
          select, textarea { 
            width: 100%; 
            padding: 12px 15px; 
            border: 2px solid #e0e0e0; 
            border-radius: 8px; 
            font-size: 16px;
            transition: border-color 0.2s;
          }
          select:focus, textarea:focus {
            outline: none;
            border-color: #6528F7;
          }
          textarea { resize: vertical; min-height: 100px; }
          button { 
            width: 100%;
            background: linear-gradient(135deg, #6528F7 0%, #A855F7 100%);
            color: white; 
            padding: 15px; 
            border: none; 
            border-radius: 8px; 
            font-size: 16px; 
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(101, 40, 247, 0.4);
          }
          .current-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .current-status.unassigned { background: #f8d7da; color: #842029; }
          .current-status.assigned { background: #fff3cd; color: #856404; }
          .current-status.in-progress { background: #cfe2ff; color: #084298; }
          .current-status.completed { background: #d1e7dd; color: #0f5132; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎫</div>
            <h1>Update Ticket Status</h1>
            <span class="ticket-id">${ticket.ticket_number}</span>
          </div>
          <div class="ticket-info">
            <h3>${ticket.subject}</h3>
            <p><span class="label">Company:</span> ${companyName}</p>
            <p><span class="label">User:</span> ${userName}</p>
            <p><span class="label">Current Status:</span> <span class="current-status ${ticket.status}">${ticket.status.replace('-', ' ')}</span></p>
            ${ticket.technician_name ? `<p><span class="label">Technician:</span> ${ticket.technician_name}</p>` : ''}
          </div>
          <form method="POST">
            <div class="form-group">
              <label for="status">📊 New Status</label>
              <select name="status" id="status" required>
                ${statusOptions}
              </select>
            </div>
            <div class="form-group">
              <label for="technicianName">👨‍🔧 Assign Technician</label>
              <select name="technicianName" id="technicianName">
                ${technicianOptions}
              </select>
            </div>
            <div class="form-group">
              <label for="note">📝 Add Note (Optional)</label>
              <textarea name="note" id="note" placeholder="Add a note or update..."></textarea>
            </div>
            <button type="submit">✅ Update Ticket</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// Handle form submission (POST)
app.post('/update/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const { status, technicianName, note } = req.body;

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (!ticket) {
    return res.status(404).send('Ticket not found');
  }

  await supabase
    .from('tickets')
    .update({
      status,
      technician_name: technicianName || ticket.technician_name,
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId);

  if (note && note.trim()) {
    await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        author_name: technicianName || 'Support Team',
        text: note.trim(),
        is_from_user: false
      });
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <html>
      <head>
        <title>Ticket Updated</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            margin: 0;
            padding: 20px;
          }
          .container { 
            background: white; 
            padding: 40px; 
            border-radius: 16px; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.2); 
            text-align: center;
            max-width: 400px;
          }
          .success-icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #198754; margin: 0 0 10px 0; }
          p { color: #6c757d; margin: 10px 0; }
          .ticket-id { font-family: monospace; background: #f8f9fa; padding: 5px 10px; border-radius: 4px; }
          .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            margin: 10px 0;
          }
          .status-badge.unassigned { background: #f8d7da; color: #842029; }
          .status-badge.assigned { background: #fff3cd; color: #856404; }
          .status-badge.in-progress { background: #cfe2ff; color: #084298; }
          .status-badge.completed { background: #d1e7dd; color: #0f5132; }
          a { color: #6528F7; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Ticket Updated!</h1>
          <p class="ticket-id">${ticket.ticket_number}</p>
          <p>Status changed to:</p>
          <div class="status-badge ${status}">${status.replace('-', ' ').toUpperCase()}</div>
          ${technicianName ? `<p>Technician: <strong>${technicianName}</strong></p>` : ''}
          <p style="margin-top: 20px;"><a href="/update/${ticketId}">← Make another update</a></p>
        </div>
      </body>
    </html>
  `);
});

// Submit ticket
app.post('/api/submit-ticket', async (req, res) => {
  try {
    const { ticket, user } = req.body;

    if (!ticket || !user) {
      return res.status(400).json({ success: false, message: 'Missing ticket or user data' });
    }

    const { subject, description, priority, contactPreference, scheduledTime } = ticket;
    const { firstName, surname, email, phone, companyName, anyDeskId } = user;

    const ticketNumber = `PIOT-${Date.now().toString(36).toUpperCase()}`;

    const { data: company } = await supabase.from('companies').select('id').eq('name', companyName).single();
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single();

    const { data: newTicket, error } = await supabase
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        subject,
        description,
        priority: priority || 'medium',
        status: 'unassigned',
        user_id: profile?.id,
        company_id: company?.id,
        contact_preference: contactPreference || 'asap',
        scheduled_time: scheduledTime || null
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create ticket' });
    }

    const baseUrl = getBaseUrl(req);
    const updateUrl = `${baseUrl}/update/${newTicket.id}`;

    const contactDisplay = contactPreference === 'scheduled' && scheduledTime 
      ? `📅 Scheduled: ${new Date(scheduledTime).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' })}`
      : '⚡ ASAP - Available now';

    const priorityColors = {
      low: { bg: '#d1e7dd', text: '#0f5132' },
      medium: { bg: '#fff3cd', text: '#856404' },
      high: { bg: '#f8d7da', text: '#842029' },
      critical: { bg: '#dc3545', text: '#ffffff' }
    };
    const pColor = priorityColors[priority] || priorityColors.medium;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
        <div style="background-color: #6528F7; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎫 New Support Ticket</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${ticketNumber}</p>
        </div>
        <div style="padding: 30px;">
          <div style="margin-bottom: 20px; text-align: center;">
            <span style="background: ${pColor.bg}; color: ${pColor.text}; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px;">
              ⚠️ ${(priority || 'medium').toUpperCase()} PRIORITY
            </span>
          </div>
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; padding: 15px 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
            <p style="margin: 0; font-size: 16px; color: #92400e; font-weight: 600;">${contactDisplay}</p>
          </div>
          <div style="text-align: center; margin-bottom: 25px;">
            <a href="${updateUrl}" style="display: inline-block; background: linear-gradient(135deg, #6528F7 0%, #A855F7 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">📝 Update Ticket Status</a>
          </div>
          <div style="background-color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #6528F7; margin: 0 0 15px 0; font-size: 18px;">📋 Issue Details</h2>
            <p style="color: #1F2937; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">${subject}</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
              <p style="color: #4B5563; line-height: 1.6; margin: 0;">${description}</p>
            </div>
          </div>
          <div style="background-color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #6528F7; margin: 0 0 15px 0; font-size: 18px;">👤 User Information</h2>
            <p><strong>Name:</strong> ${firstName} ${surname}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
            ${email ? `<p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>` : ''}
          </div>
          <div style="background-color: white; padding: 20px; border-radius: 12px;">
            <h2 style="color: #6528F7; margin: 0 0 15px 0; font-size: 18px;">🖥️ Remote Access</h2>
            <p><strong>AnyDesk ID:</strong> <span style="font-family: monospace; background: #f3f4f6; padding: 8px 16px; border-radius: 6px; font-size: 18px;">${anyDeskId}</span></p>
          </div>
        </div>
      </div>
    `;

    const supportEmail = process.env.SUPPORT_EMAIL || 'michael@piot.co.za';
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: supportEmail,
      subject: `[${ticketNumber}] ${companyName} - ${firstName} ${surname} - Support Request`,
      html: emailHtml,
      replyTo: email || undefined,
    });

    res.json({
      success: true,
      message: 'Ticket submitted successfully',
      ticketId: newTicket.id,
      ticketNumber: ticketNumber,
    });

  } catch (error) {
    console.error('Error submitting ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to submit ticket' });
  }
});

// Get user tickets
app.get('/api/tickets/:userId', async (req, res) => {
  const { userId } = req.params;
  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  res.json({ success: true, tickets: tickets || [] });
});

// Get single ticket
app.get('/api/ticket/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }
  res.json({ success: true, ticket });
});

// Export for Vercel
module.exports = app;
