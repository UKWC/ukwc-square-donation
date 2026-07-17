const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  try {
    const { sourceId, amount, donor = {} } = JSON.parse(event.body || '{}');
    const numericAmount = Number(amount);

    if (!sourceId || !Number.isFinite(numericAmount) || numericAmount < 1) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Invalid payment request.' }) };
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) throw new Error('SQUARE_ACCESS_TOKEN is not configured.');

    const noteParts = [
      'UKWC Scholarship Fund donation',
      donor.dedicationType && donor.dedicationName
        ? `${donor.dedicationType}: ${donor.dedicationName}`
        : ''
    ].filter(Boolean);

    const squareResponse = await fetch('https://connect.squareup.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2026-01-22'
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: crypto.randomUUID(),
        location_id: 'AW14764YKZHQG',
        amount_money: {
          amount: Math.round(numericAmount * 100),
          currency: 'USD'
        },
        autocomplete: true,
        buyer_email_address: donor.email || undefined,
        note: noteParts.join(' — '),
        reference_id: `UKWC-${Date.now()}`
      })
    });

    const squareData = await squareResponse.json();

    if (!squareResponse.ok) {
      const message = squareData.errors?.map(e => e.detail || e.code).join(' ') || 'Square declined the payment.';
      return { statusCode: squareResponse.status, body: JSON.stringify({ success: false, message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        paymentId: squareData.payment?.id,
        status: squareData.payment?.status
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: error.message || 'Unable to process payment.' })
    };
  }
};
