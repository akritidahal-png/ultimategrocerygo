// checkout-script.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ---------------- CONFIG ----------------
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SUX2cAtxwsqQt5Tf4eFuJC4uXKoauXjBAU5TiHC7MZnlR7rI6HIyHCMYJFeaCU7rSkQ4FBJD5q53QOw3DPKcOlg00VHp43m4l';
const CREATE_PAYMENT_INTENT_URL = '/api/create-payment-intent';

// ---------------- SUPABASE ----------------
const supabase = createClient(
  'https://vwxxqjvltbdtgeccydtp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
);

// ---------------- TROLLEY & TOTALS ----------------
let trolley = JSON.parse(localStorage.getItem('grocerygo_trolley') || '[]');

function updateTotals() {
  const subtotal = trolley.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
  const deliveryFee = subtotal >= 120 ? 0 : 10;
  const total = subtotal + deliveryFee;

  const subtotalEl = document.getElementById('subtotalText');
  const deliveryEl = document.getElementById('deliveryFeeText');
  const totalEl = document.getElementById('totalText');

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  if (deliveryEl) deliveryEl.textContent = `$${deliveryFee.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

  return { subtotal, deliveryFee, total };
}

// ---------------- STRIPE ELEMENTS ----------------
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
const elements = stripe.elements();

// Wait for DOM to load to mount Elements
window.addEventListener('DOMContentLoaded', () => {
  const cardNumber = elements.create('cardNumber', { showIcon: true });
  const cardExpiry = elements.create('cardExpiry');
  const cardCVC = elements.create('cardCvc');

  cardNumber.mount('#cardNumber');
  cardExpiry.mount('#cardExpiry');
  cardCVC.mount('#cardCVC');

  // ---------------- PAY BUTTON ----------------
  const payBtn = document.getElementById('payBtn');
  if (!payBtn) return;

  payBtn.addEventListener('click', async () => {
    const msg = document.getElementById('payMessage');
    payBtn.disabled = true;
    if (msg) msg.textContent = 'Processing...';

    const { subtotal, deliveryFee, total } = updateTotals();

    const payload = {
      trolley,
      name: document.getElementById('name')?.value.trim() || '',
      email: document.getElementById('email')?.value.trim() || '',
      mobile: document.getElementById('mobile')?.value.trim() || '',
      unit: document.getElementById('unit')?.value.trim() || '',
      streetNo: document.getElementById('streetNo')?.value.trim() || '',
      streetName: document.getElementById('streetName')?.value.trim() || '',
      suburb: document.getElementById('suburb')?.value.trim() || '',
      postcode: document.getElementById('postcode')?.value.trim() || '',
      state: document.getElementById('state')?.value || '',
      slot: document.getElementById('slotSelect')?.value || '',
      subtotal,
      deliveryFee,
      total
    };

    try {
      // Create payment intent
      const res = await fetch(CREATE_PAYMENT_INTENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment intent failed');

      const { clientSecret, orderNumber } = data;

      // Confirm payment
      const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: {
            name: payload.name,
            email: payload.email,
            phone: payload.mobile
          }
        }
      });

      if (stripeError) throw stripeError;

      // Redirect with order number
      window.location.href = `success.html?order=${orderNumber}`;

    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = 'Error: ' + err.message;
      payBtn.disabled = false;
    }
  });
});
