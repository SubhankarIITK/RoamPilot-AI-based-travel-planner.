# RoamPilot email OTP setup

Signup verification and password recovery require an SMTP account.

Add these values to `server/.env`:

```env
OTP_SECRET=replace_with_a_long_random_secret_different_from_jwt_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_app_password
EMAIL_FROM=RoamPilot <your_email@gmail.com>
```

For Gmail, enable two-step verification and create an App Password. Do not use
your normal Gmail password. Other SMTP providers can be used by replacing the
host, port, security mode, username, password, and sender address.

Alternatively, provide a complete connection string:

```env
SMTP_URL=smtps://username:password@smtp.example.com:465
EMAIL_FROM=RoamPilot <noreply@example.com>
```

## Implemented protections

- Six-digit codes generated with a cryptographic random-number generator
- Keyed OTP hashes in MongoDB; plaintext codes are never stored
- Ten-minute expiry and single-use invalidation
- Five attempts per code and a 60-second resend cooldown
- Separate request and verification endpoint rate limits
- Generic forgot-password response to reduce account enumeration
- Existing JWT sessions expire after a successful password reset
- Email delivery errors do not expose SMTP details

Restart the server after changing environment variables.
