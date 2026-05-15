import nodemailer from 'nodemailer';

function createTransport() {
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
  const transporter = createTransport();
  const subject = purpose === 'register' ? '注册验证码' : '登录验证码';
  const text = `您的验证码是：${code}，10分钟内有效。`;

  if (!transporter) {
    console.log(`[DEV EMAIL] To: ${email} | ${subject} | ${text}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'Ulysses Note <noreply@example.com>',
    to: email,
    subject,
    text,
  });
}

export async function sendSmsCode(phone: string, code: string, purpose: string): Promise<void> {
  // TODO: 接入短信服务商 (阿里云 SMS / 腾讯云等)
  // 当前为开发模式：打印验证码到控制台
  console.log(`[DEV SMS] To: ${phone} | purpose: ${purpose} | code: ${code}`);
}
