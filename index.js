const express = require('express');
const app = express();
const { resolve } = require('path');
const cors = require('cors');


// Copy the .env.example in the root into a .env file in this folder\
require('dotenv').config({ path: './.env' });

// Ensure environment variables are set.
// checkEnv();
// Use CORS middleware
app.use(cors());
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: { // For sample support and debugging, not required for production:
    name: "stripe-samples/checkout-one-time-payments",
    version: "0.0.1",
    url: "https://github.com/stripe-samples/checkout-one-time-payments"
  }
});

app.use(express.static(__dirname + '/public'));
let nodeModulesDir = 'node_modules';
app.use("/node_modules", express.static(nodeModulesDir));

app.use(express.static(process.env.STATIC_DIR));
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);

app.get('/hi', (req, res) => {
   res.send("hi");
});

// const root = require("path").join(__dirname, "build");
// app.use(express.static(root));
// app.get("*", (req, res) => {
//     res.sendFile("index.html", { root });
// });

const port = process.env.PORT || 5000;

app.listen(port, () => {
    console.log(`App running on port ${port}.`);
});

app.get('/', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/index.html');
  res.sendFile(path);
});

app.get('/config', async (req, res) => {
  const price = await stripe.prices.retrieve(process.env.PRICE);

  res.send({
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
    unitAmount: price.unit_amount,
    currency: price.currency,
  });
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/api/checkout-session', async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

app.post('/api/create-checkout-session', async (req, res) => {
  const domainURL = process.env.DOMAIN;
  const { amount, isMonthly  } = req.body;
  //const { quantity } = req.body;

  // Create new Checkout Session for the order
  // Other optional params include:
  // [billing_address_collection] - to display billing address details on the page
  // [customer] - if you have an existing Stripe Customer ID
  // [customer_email] - lets you prefill the email input in the Checkout page
  // [automatic_tax] - to automatically calculate sales tax, VAT and GST in the checkout page
  // For full details see https://stripe.com/docs/api/checkout/sessions/create
  const session = await stripe.checkout.sessions.create({
    // mode: 'payment',
    mode: isMonthly ? 'subscription' : 'payment', // Use boolean check for monthly

    line_items: [
      {
        price_data: {
          unit_amount: amount, // Amount in the smallest currency unit (e.g., pence for GBP)
          currency: "gbp",
          product_data: {
            name: isMonthly ? 'Monthly Support' : 'Support',
          },
          ...(isMonthly && {
            recurring: { interval: 'month' }, // Monthly subscription when isMonthly is true
          }),
        },
        quantity: 1,
      },
    ],
    // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
    success_url: `https://gazagreatminds.org/completed/`,
    cancel_url: `${domainURL}`,
    // automatic_tax: {enabled: true},
  });
  res.json({url: session.url}) // <-- this is the changed line
// return res.redirect(303, session.url);
});

// Webhook handler for asynchronous events.
app.post('/webhook', async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  if (eventType === 'checkout.session.completed') {
    console.log(`🔔  Payment received!`);
  }

  res.sendStatus(200);
});

app.post('/create-intent', async (req, res) => {
  console.log('testOutRes', res);
  const intent = await stripe.paymentIntents.create({
    // To allow saving and retrieving payment methods, provide the Customer ID.
    customer: customer.id,
    amount: 50,
    currency: 'gbp',
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {enabled: true},
  });
  res.json({client_secret: intent.client_secret});
});

app.listen(4242, () => console.log(`Node server listening on port ${4242}!`));


// function checkEnv() {
//   const price = process.env.PRICE;
//   if (price === "price_12345" || !price) {
//     console.log("You must set a Price ID in the environment variables. Please see the README.");
//     process.exit(0);
//   }
// }
