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

module.exports = { sendPasswordResetEmail };
