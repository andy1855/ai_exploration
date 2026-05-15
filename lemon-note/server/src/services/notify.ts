import nodemailer from 'nodemailer';
import Dysmsapi, * as $Dysmsapi from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';

// ── Email ──────────────────────────────────────────────────────────────────

function createEmailTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmailCode(email: string, code: string, purpose: string): Promise<void> {
  const transporter = createEmailTransport();
  const subject = purpose === 'register' ? '注册验证码' : '登录验证码';
  const text = `您的验证码是：${code}，10分钟内有效。`;

  if (!transporter) {
    console.log(`[DEV EMAIL] To: ${email} | ${subject} | ${text}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'Lemon Note <noreply@example.com>',
    to: email,
    subject,
    text,
  });
}

// ── SMS (阿里云短信) ──────────────────────────────────────────────────────

function createSmsClient(): Dysmsapi | null {
  const { SMS_ACCESS_KEY_ID, SMS_ACCESS_KEY_SECRET } = process.env;
  if (!SMS_ACCESS_KEY_ID || !SMS_ACCESS_KEY_SECRET) return null;

  const config = new $OpenApi.Config({
    accessKeyId: SMS_ACCESS_KEY_ID,
    accessKeySecret: SMS_ACCESS_KEY_SECRET,
    endpoint: 'dysmsapi.aliyuncs.com',
  });
  return new Dysmsapi(config);
}

export async function sendSmsCode(phone: string, code: string, _purpose: string): Promise<void> {
  const client = createSmsClient();

  if (!client) {
    console.log(`[DEV SMS] To: ${phone} | code: ${code}`);
    return;
  }

  const signName = process.env.SMS_SIGN_NAME ?? '';
  const templateCode = process.env.SMS_TEMPLATE_CODE ?? '';

  if (!signName || !templateCode) {
    console.warn('[SMS] SMS_SIGN_NAME or SMS_TEMPLATE_CODE not configured, skipping send');
    return;
  }

  const request = new $Dysmsapi.SendSmsRequest({
    phoneNumbers: phone,
    signName,
    templateCode,
    templateParam: JSON.stringify({ code }),
  });

  const response = await client.sendSms(request);
  const body = response.body;
  if (!body || body.code !== 'OK') {
    throw new Error(`短信发送失败：${body?.message ?? 'unknown'} (${body?.code ?? 'unknown'})`);
  }
}
