import nodemailer from 'nodemailer';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

function buildFrom(): string {
  const fromName = process.env.SMTP_FROM_NAME || 'Mokpyo';
  return process.env.SMTP_FROM
    ? `"${fromName}" <${process.env.SMTP_FROM}>`
    : `"${fromName}" <noreply@mokpyo.local>`;
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const from = buildFrom();

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #4F46E5;">Mokpyo 이메일 인증</h2>
      <p>아래 인증 코드를 입력하여 회원가입을 완료해주세요.</p>
      <div style="background: #F3F4F6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F2937;">${code}</span>
      </div>
      <p style="color: #6B7280; font-size: 14px;">이 코드는 30분 동안 유효합니다.</p>
      <p style="color: #6B7280; font-size: 14px;">본인이 요청하지 않은 경우 이 이메일을 무시하세요.</p>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({
      from,
      to,
      subject: `[Mokpyo] 이메일 인증 코드: ${code}`,
      html,
    });
  } else {
    console.log(`[Email Verification] SMTP not configured. Code for ${to}: ${code}`);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = buildFrom();

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #4F46E5;">Mokpyo 비밀번호 재설정</h2>
      <p>아래 버튼을 눌러 새 비밀번호를 설정해주세요.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #4F46E5; color: #FFFFFF; text-decoration: none; border-radius: 8px; padding: 14px 28px; font-size: 16px; font-weight: bold;">비밀번호 재설정</a>
      </div>
      <p style="color: #6B7280; font-size: 14px;">버튼이 열리지 않으면 아래 주소를 브라우저에 붙여넣으세요.</p>
      <p style="color: #6B7280; font-size: 13px; word-break: break-all;">${resetUrl}</p>
      <p style="color: #6B7280; font-size: 14px;">이 링크는 60분 동안 유효합니다.</p>
      <p style="color: #6B7280; font-size: 14px;">본인이 요청하지 않은 경우 이 이메일을 무시하세요. 비밀번호는 변경되지 않습니다.</p>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({
      from,
      to,
      subject: '[Mokpyo] 비밀번호 재설정 안내',
      html,
    });
  } else {
    console.log(`[Password Reset] SMTP not configured. Reset link for ${to}: ${resetUrl}`);
  }
}
