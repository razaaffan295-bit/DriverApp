const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://a51005a36356f96796acc5d581b02d23@o4511186096881664.ingest.us.sentry.io/4511186230509568",
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',
  sendDefaultPii: false,
  tracesSampleRate: 1.0,
});
