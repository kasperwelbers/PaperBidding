// Sending email: only sign-in codes (requested by the user). We send no
// invitations or other bulk email; planners use their own channels.
// Production: Scaleway Transactional Email (HTTP API, the default) or
// Cloudflare Email Service (a binding; beta). Development: print to the
// console. Tests: keep in memory.

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(email: Email): Promise<void>;
}

/** Emails "sent" in tests (ENVIRONMENT = "test") */
export const sentTestEmails: Email[] = [];

const memorySender: EmailSender = {
  async send(email) {
    sentTestEmails.push(email);
  },
};

const consoleSender: EmailSender = {
  async send(email) {
    console.log(`\n[dev] email to ${email.to}\n${email.subject}\n\n${email.text}\n`);
  },
};

/** Parses "Name <address>" or "address" */
function parseFrom(from: string) {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || undefined, email: m[2]! } : { email: from.trim() };
}

function scalewaySender(env: Env, keys: { secretKey: string; projectId: string }): EmailSender {
  const region = env.SCW_REGION || "fr-par";
  const url = `https://api.scaleway.com/transactional-email/v1alpha1/regions/${region}/emails`;
  return {
    async send(email) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": keys.secretKey,
        },
        body: JSON.stringify({
          from: parseFrom(env.EMAIL_FROM),
          to: [{ email: email.to }],
          subject: email.subject,
          text: email.text,
          project_id: keys.projectId,
        }),
      });
      if (!res.ok)
        throw new Error(`Sending email failed (${res.status}): ${await res.text()}`);
    },
  };
}

function cloudflareSender(env: Env): EmailSender {
  return {
    async send(email) {
      const from = parseFrom(env.EMAIL_FROM);
      await env.EMAIL.send({
        to: email.to,
        from: from.name ? { name: from.name, email: from.email } : from.email,
        subject: email.subject,
        text: email.text,
      } as never);
    },
  };
}

/** Whether sign-in codes can be sent (in development: printed to the console) */
export function emailConfigured(env: Env) {
  try {
    getEmailSender(env);
    return true;
  } catch {
    return false;
  }
}

export function getEmailSender(env: Env): EmailSender {
  if (env.ENVIRONMENT === "test") return memorySender;
  if (env.EMAIL_PROVIDER === "cloudflare" && env.ENVIRONMENT !== "development") return cloudflareSender(env);
  if (env.SCW_SECRET_KEY && env.SCW_PROJECT_ID && env.EMAIL_FROM)
    return scalewaySender(env, { secretKey: env.SCW_SECRET_KEY, projectId: env.SCW_PROJECT_ID });
  if (env.ENVIRONMENT === "development") return consoleSender;
  throw new Error(
    "Email is not set up yet: add the SCW_SECRET_KEY and SCW_PROJECT_ID secrets (or use EMAIL_PROVIDER=cloudflare). See the README, Email",
  );
}
