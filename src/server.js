'use strict';

const app = require('./app');
const config = require('./config');

app.listen(config.PORT, () => {
  console.log(`Booking API listening on http://localhost:${config.PORT} (code TTL ${config.CODE_TTL_SECONDS}s)`);
});
