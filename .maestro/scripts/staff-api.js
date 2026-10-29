// Maestro runScript (GraalJS): the staff actions the Phase 2 flows react to, done through existing
// admin endpoints so a seller flow has something live to see. Signs in as the staff account,
// performs ACTION, then leaves (the access token is never stored).
//   ACTION=broadcast       → POST /admin/notification-broadcasts, sent at once to the seller
//                            audience (in-app). Uses TITLE and MESSAGE; optional NOTIFICATION_TYPE
//                            (default PROMOTION) and AUDIENCE (default SELLERS).
//   ACTION=find-ticket     → GET /admin/support-tickets?q=SUBJECT; outputs ticketId of the newest
//                            seller ticket whose subject matches.
//   ACTION=support-reply   → POST /admin/support-tickets/TICKET_ID/messages with MESSAGE.
//   ACTION=support-status  → PATCH /admin/support-tickets/TICKET_ID to STATUS
//                            (OPEN, IN_PROGRESS, RESOLVED or CLOSED).
// Env: API_URL, ADMIN_IDENTIFIER, ADMIN_PASSWORD, ACTION and what ACTION needs.
/* global http, json, output, API_URL, ADMIN_IDENTIFIER, ADMIN_PASSWORD, ACTION, TITLE, MESSAGE, NOTIFICATION_TYPE, AUDIENCE, SUBJECT, TICKET_ID, STATUS */

const base = `${API_URL}/api/v1`;
const headers = { 'Content-Type': 'application/json', 'x-tv-portal': 'admin' };

const login = http.post(`${base}/auth/login`, {
  headers,
  body: JSON.stringify({
    identifier: ADMIN_IDENTIFIER,
    password: ADMIN_PASSWORD,
    portal: 'admin',
    rememberMe: false,
  }),
});
if (login.status !== 200) throw new Error(`E2E admin login failed: ${login.status}`);
const auth = { ...headers, Authorization: `Bearer ${json(login.body).data.accessToken}` };

function expectOk(response, what) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${what} failed: ${response.status} ${response.body}`);
  }
}

const key = { 'Idempotency-Key': `e2e-${ACTION}-${Date.now()}` };

if (ACTION === 'broadcast') {
  expectOk(
    http.post(`${base}/admin/notification-broadcasts`, {
      headers: { ...auth, ...key },
      body: JSON.stringify({
        title: TITLE,
        message: MESSAGE,
        notificationType: typeof NOTIFICATION_TYPE === 'undefined' ? 'PROMOTION' : NOTIFICATION_TYPE,
        audience: typeof AUDIENCE === 'undefined' ? 'SELLERS' : AUDIENCE,
        channels: ['IN_APP'],
        status: 'SENT',
      }),
    }),
    'Sending the broadcast',
  );
} else if (ACTION === 'find-ticket') {
  const response = http.get(
    `${base}/admin/support-tickets?q=${encodeURIComponent(SUBJECT)}&requesterType=SELLER&limit=20`,
    { headers: auth },
  );
  expectOk(response, 'Looking for the ticket');
  const body = json(response.body);
  const items = Array.isArray(body.data) ? body.data : (body.data && body.data.items) || [];
  const match = items.find((item) => String(item.subject || '').indexOf(SUBJECT) !== -1);
  if (!match) throw new Error(`No seller ticket with the subject "${SUBJECT}"`);
  output.ticketId = match.id;
} else if (ACTION === 'support-reply') {
  expectOk(
    http.post(`${base}/admin/support-tickets/${encodeURIComponent(TICKET_ID)}/messages`, {
      headers: { ...auth, ...key },
      body: JSON.stringify({ body: MESSAGE, isInternal: false }),
    }),
    'Replying to the ticket',
  );
} else if (ACTION === 'support-status') {
  expectOk(
    http.patch(`${base}/admin/support-tickets/${encodeURIComponent(TICKET_ID)}`, {
      headers: { ...auth, ...key },
      body: JSON.stringify({ status: STATUS }),
    }),
    'Changing the ticket status',
  );
} else {
  throw new Error(`Unknown ACTION "${ACTION}"`);
}
