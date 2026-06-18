const nodemailer = require('nodemailer');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    // Dev fallback: Ethereal (fake SMTP, no real emails sent)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Ethereal email account:', testAccount.user);
  }

  return transporter;
}

async function sendPasswordResetEmail(toEmail, resetLink) {
  const transport = await getTransporter();

  const info = await transport.sendMail({
    from: process.env.EMAIL_FROM || '"E-Shop" <noreply@eshop.gr>',
    to: toEmail,
    subject: 'Επαναφορά κωδικού πρόσβασης',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2 style="color: #2563eb;">Επαναφορά Κωδικού</h2>
        <p>Λάβαμε αίτημα για επαναφορά του κωδικού σου.</p>
        <p>Κάνε κλικ στο παρακάτω κουμπί για να ορίσεις νέο κωδικό:</p>
        <a href="${resetLink}" style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 16px 0;
        ">Επαναφορά Κωδικού</a>
        <p style="color: #888; font-size: 13px;">
          Ο σύνδεσμος λήγει σε <strong>1 ώρα</strong>.<br>
          Αν δεν ζήτησες επαναφορά, αγνόησε αυτό το email.
        </p>
      </div>
    `,
  });

  // In dev (Ethereal), log preview URL to terminal
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('📧 Preview email at:', previewUrl);
  }

  return info;
}

async function sendOrderConfirmationEmail(toEmail, order) {
  const transport = await getTransporter();

  const shippingMethodLabel = {
    courier_standard: 'Τυπική αποστολή (3-5 εργάσιμες)',
    courier_express: 'Γρήγορη αποστολή (1-2 εργάσιμες)',
    pickup: 'Παραλαβή από κατάστημα'
  }[order.shippingMethod] || order.shippingMethod;

  const paymentMethodLabel = {
    cod: 'Αντικαταβολή',
    card_mock: 'Πληρωμή με κάρτα',
    bank_transfer: 'Τραπεζική μεταφορά'
  }[order.paymentMethod] || order.paymentMethod;

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding:8px 0; border-bottom:1px solid #f0f0f0;">${item.name}${item.size ? ` <span style="color:#888;">(${item.size})</span>` : ''}</td>
      <td style="padding:8px 0; border-bottom:1px solid #f0f0f0; text-align:center;">${item.quantity}</td>
      <td style="padding:8px 0; border-bottom:1px solid #f0f0f0; text-align:right;">€${Number(item.unit_price).toFixed(2)}</td>
      <td style="padding:8px 0; border-bottom:1px solid #f0f0f0; text-align:right;">€${(item.quantity * item.unit_price).toFixed(2)}</td>
    </tr>
  `).join('');

  const addressHtml = order.shippingMethod !== 'pickup'
    ? `<p style="margin:4px 0;">${order.address}</p>`
    : `<p style="margin:4px 0;">Παραλαβή από κατάστημα</p>`;

  const info = await transport.sendMail({
    from: process.env.EMAIL_FROM || '"E-Shop" <noreply@eshop.gr>',
    to: toEmail,
    subject: `Επιβεβαίωση Παραγγελίας #${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#222;">
        <div style="background:#2563eb;padding:24px 32px;border-radius:10px 10px 0 0;">
          <h1 style="margin:0;color:white;font-size:22px;">✅ Η παραγγελία σας επιβεβαιώθηκε!</h1>
        </div>
        <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
          <p>Αγαπητέ/ή <strong>${order.recipientName}</strong>,</p>
          <p>Η παραγγελία σας <strong>#${order.id}</strong> ελήφθη επιτυχώς και επεξεργάζεται.</p>

          <h3 style="margin:20px 0 10px;color:#2563eb;">Προϊόντα</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="color:#888;">
                <th style="text-align:left;padding-bottom:6px;">Προϊόν</th>
                <th style="text-align:center;padding-bottom:6px;">Ποσ.</th>
                <th style="text-align:right;padding-bottom:6px;">Τιμή</th>
                <th style="text-align:right;padding-bottom:6px;">Σύνολο</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <table style="width:100%;font-size:14px;margin-top:12px;">
            <tr><td style="color:#888;">Υποσύνολο</td><td style="text-align:right;">€${Number(order.subtotal).toFixed(2)}</td></tr>
            <tr><td style="color:#888;">Μεταφορικά</td><td style="text-align:right;">€${Number(order.shippingCost).toFixed(2)}</td></tr>
            ${order.discountAmount > 0 ? `<tr><td style="color:#16a34a;">Έκπτωση (${order.discountCode})</td><td style="text-align:right;color:#16a34a;">-€${Number(order.discountAmount).toFixed(2)}</td></tr>` : ''}
            <tr><td style="font-weight:bold;padding-top:8px;font-size:16px;">Σύνολο</td><td style="text-align:right;font-weight:bold;font-size:16px;padding-top:8px;">€${Number(order.totalAmount).toFixed(2)}</td></tr>
          </table>

          <div style="margin-top:20px;display:flex;gap:20px;">
            <div style="flex:1;">
              <h4 style="margin:0 0 6px;color:#2563eb;">Αποστολή</h4>
              <p style="margin:4px 0;color:#555;font-size:14px;">${shippingMethodLabel}</p>
              ${addressHtml}
            </div>
            <div style="flex:1;">
              <h4 style="margin:0 0 6px;color:#2563eb;">Πληρωμή</h4>
              <p style="margin:4px 0;color:#555;font-size:14px;">${paymentMethodLabel}</p>
            </div>
          </div>

          <p style="margin-top:24px;color:#888;font-size:13px;">Μπορείτε να παρακολουθείτε την παραγγελία σας από τον λογαριασμό σας.</p>
        </div>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`📧 Order #${order.id} confirmation email:`, previewUrl);
  return info;
}

async function sendOrderStatusEmail(toEmail, order) {
  const transport = await getTransporter();

  const subjects = {
    processing: `Παραγγελία #${order.id} — Σε επεξεργασία`,
    shipped:    `Παραγγελία #${order.id} — Απεστάλη! 🚚`,
    delivered:  `Παραγγελία #${order.id} — Παραδόθηκε! ✅`,
    cancelled:  `Παραγγελία #${order.id} — Ακυρώθηκε`,
  };

  const bodies = {
    processing: `
      <h2 style="color:#2563eb;">Η παραγγελία σας είναι σε επεξεργασία</h2>
      <p>Ετοιμάζουμε την παραγγελία σας <strong>#${order.id}</strong> για αποστολή.</p>
      <p>Θα σας ενημερώσουμε μόλις αποσταλεί.</p>
    `,
    shipped: `
      <h2 style="color:#2563eb;">Η παραγγελία σας απεστάλη! 🚚</h2>
      <p>Η παραγγελία σας <strong>#${order.id}</strong> βρίσκεται καθ' οδόν.</p>
      <p>Αναμενόμενη παράδοση σε <strong>1-5 εργάσιμες ημέρες</strong>.</p>
    `,
    delivered: `
      <h2 style="color:#16a34a;">Η παραγγελία σας παραδόθηκε! ✅</h2>
      <p>Η παραγγελία σας <strong>#${order.id}</strong> παραδόθηκε επιτυχώς.</p>
      <p>Ελπίζουμε να σας ικανοποίησε! Μπορείτε να αφήσετε αξιολόγηση για τα προϊόντα σας.</p>
    `,
    cancelled: `
      <h2 style="color:#dc2626;">Η παραγγελία σας ακυρώθηκε</h2>
      <p>Η παραγγελία σας <strong>#${order.id}</strong> ακυρώθηκε.</p>
      ${order.wasRefunded ? '<p>Η επιστροφή χρημάτων θα πραγματοποιηθεί εντός <strong>3-5 εργάσιμων ημερών</strong>.</p>' : ''}
    `,
  };

  const body = bodies[order.status];
  if (!body) return;

  const info = await transport.sendMail({
    from: process.env.EMAIL_FROM || '"E-Shop" <noreply@eshop.gr>',
    to: toEmail,
    subject: subjects[order.status],
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;color:#222;">
        <div style="background:#2563eb;padding:20px 32px;border-radius:10px 10px 0 0;">
          <h1 style="margin:0;color:white;font-size:20px;">E-Shop</h1>
        </div>
        <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
          ${body}
          <p style="margin-top:20px;color:#888;font-size:13px;">Δείτε λεπτομέρειες παραγγελίας στον λογαριασμό σας.</p>
        </div>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`📧 Order #${order.id} status (${order.status}) email:`, previewUrl);
  return info;
}

module.exports = { sendPasswordResetEmail, sendOrderConfirmationEmail, sendOrderStatusEmail };
