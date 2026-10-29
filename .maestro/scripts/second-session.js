// Maestro runScript (GraalJS): signs in as the seller through the API so a second session exists
// on the account, for the "sign out other devices" flow. The access token is not kept.
// Env: API_URL, SELLER_EMAIL, SELLER_PASSWORD.
/* global http, json, API_URL, SELLER_EMAIL, SELLER_PASSWORD */
const response = http.post(API_URL + '/api/v1/auth/login', {
  headers: { 'Content-Type': 'application/json', 'x-tv-portal': 'seller' },
  body: JSON.stringify({
    identifier: SELLER_EMAIL,
    password: SELLER_PASSWORD,
    portal: 'seller',
    rememberMe: false,
  }),
});
if (response.status !== 200) {
  throw new Error('E2E second session failed: ' + response.status);
}
json(response.body);
