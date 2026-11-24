const hubspot = require('@hubspot/api-client');

function createClient(accessToken) {
  return new hubspot.Client({ accessToken });
}

module.exports = { createClient };
