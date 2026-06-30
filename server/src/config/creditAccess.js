export const getCreditExemptEmails = () =>
  new Set(
    String(process.env.CREDIT_EXEMPT_EMAILS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );

export const isCreditExemptUser = user =>
  user?.role === 'admin' ||
  Boolean(user?.email && getCreditExemptEmails().has(String(user.email).toLowerCase()));
