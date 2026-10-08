import { describe, it, expect } from 'vitest';
import { isPrivateAddress, validateWebhookUrl, signPayload, sendWebhook } from './webhook';

describe('webhook safety', () => {
  it('사설·루프백 주소를 식별한다', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('URL 정적 검사: https 만, 내부 호스트·IP·자격증명 거부', () => {
    const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;
    expect(validateWebhookUrl('https://hooks.example.com/x', prod)).toBeNull();
    expect(validateWebhookUrl('http://hooks.example.com/x', prod)).toMatch(/https/);
    expect(validateWebhookUrl('http://hooks.example.com/x', { NODE_ENV: 'development' } as any)).toBeNull();
    expect(validateWebhookUrl('https://localhost/x', prod)).toMatch(/내부/);
    expect(validateWebhookUrl('https://10.0.0.5/x', prod)).toMatch(/내부/);
    expect(validateWebhookUrl('https://metadata.internal/x', prod)).toMatch(/내부/);
    expect(validateWebhookUrl('https://user:pw@hooks.example.com/x', prod)).toMatch(/인증 정보/);
    expect(validateWebhookUrl('not a url', prod)).toMatch(/URL/);
  });

  it('HMAC 서명 형식', () => {
    expect(signPayload('s', '{"a":1}')).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('실행 시 사설 IP 로 해석되면 전송하지 않는다', async () => {
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response('ok', { status: 200 }); }) as unknown as typeof fetch;
    await expect(sendWebhook({ url: 'https://127.0.0.1/hook', event: 'x', deliveryId: '1', payload: {}, fetchImpl }))
      .rejects.toThrow(/내부/);
    expect(called).toBe(false);
  });

  it('2xx 가 아니면 실패로 던진다', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    // DNS 해석을 피하기 위해 공인 IP 리터럴 사용
    await expect(sendWebhook({ url: 'https://8.8.8.8/hook', event: 'x', deliveryId: '1', payload: {}, fetchImpl }))
      .rejects.toThrow(/500/);
  });

  it('성공 시 서명·이벤트 헤더를 보낸다', async () => {
    let seen: Record<string, string> = {};
    const fetchImpl = (async (_u: any, init: any) => { seen = init.headers; return new Response('', { status: 200 }); }) as unknown as typeof fetch;
    const r = await sendWebhook({ url: 'https://8.8.8.8/hook', secret: 'k', event: 'status_changed', deliveryId: 'd1', payload: { a: 1 }, fetchImpl });
    expect(r.status).toBe(200);
    expect(seen['X-Mokpyo-Event']).toBe('status_changed');
    expect(seen['X-Mokpyo-Signature']).toMatch(/^sha256=/);
  });
});
