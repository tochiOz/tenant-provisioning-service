const styles = `
  body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; padding: 40px 30px; border-radius: 8px; }
  h1 { font-size: 22px; font-weight: 600; color: #000000; margin-bottom: 20px; text-align: center; }
  p { font-size: 15px; color: #333333; line-height: 1.6; margin: 16px 0; }
  .code-box { background-color: #0d54c7; padding: 14px; font-size: 20px; font-weight: bold; border-radius: 6px; margin: 30px 0; letter-spacing: 2px; color: #ffffff; text-align: center; }
  .button-container { text-align: center; margin: 24px 0; }
  .button { display: inline-block; background-color: #0d54c7; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 22px; border-radius: 6px; }
  .footer { font-size: 12px; color: #888888; text-align: center; margin-top: 40px; }
`;

const layout = (title: string, content: string, email: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    ${content}
    <p>Cheers,<br />The Team</p>
  </div>
  <div class="footer">
    Sent to ${email}<br />
    &copy;${new Date().getFullYear()}. All rights reserved.
  </div>
</body>
</html>
`;

/** Sent when a tenant signs up or asks for a new code. */
export const verificationCodeEmail = (verificationCode: number, companyName: string, email: string): string =>
  layout(
    "Your Verification Code",
    `
    <h1>Your Verification Code</h1>
    <p>Hi ${companyName},</p>
    <p>Use the verification code below to verify your email address:</p>
    <div class="code-box">${verificationCode}</div>
    <p>If you didn't request this code, you can safely ignore this email.</p>
    `,
    email,
  );

/** Sent once the tenant's environment has been provisioned. */
export const tenantReadyEmail = (companyName: string, customDomain: string, email: string): string =>
  layout(
    "Your Account Is Ready",
    `
    <h1>Welcome! Your Tenant Is Now Ready</h1>
    <p>Hi ${companyName},</p>
    <p>
      Your sign-up was successful and your tenant environment for <strong>${companyName}</strong> is now ready to use.
      Sign in with <strong>${email}</strong>, the email you registered with.
    </p>
    <div class="button-container">
      <a class="button" href="${customDomain}" target="_blank">Go to Dashboard</a>
    </div>
    `,
    email,
  );
