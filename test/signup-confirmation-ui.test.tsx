// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { SignupModal } from '@/components/SignupModal';

it('sends the exact entered password and confirmation through the rendered signup form', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let signup: Record<string, unknown> | undefined;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/otp/send') return Response.json({ success: true });
    if (url === '/api/auth/otp/verify') return Response.json({ success: true, verificationReceipt: 'controlled-otp-receipt' });
    if (url === '/api/tenant/signup') {
      signup = JSON.parse(String(init?.body));
      return Response.json({ success: false, error: 'Controlled fixture stops before provisioning.' }, { status: 503 });
    }
    throw new Error('Unexpected request');
  }));
  const fill = async (label: string, value: string) => {
    const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const submit = async (id: string) => { await act(async () => { container.querySelector(`#${id}`)!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); };
  try {
    await act(async () => root.render(<SignupModal isOpen onClose={() => {}} onSuccess={() => {}} />));
    await fill('Organization name', 'Controlled Signup');
    await submit('step1-form');
    await fill('Administrator name', 'Signup Owner');
    await fill('Corporate work email', 'owner@controlled.example');
    const password = ' Exact Password Bytes#2026 ';
    await fill('Password', password);
    await fill('Confirm password', password);
    // Existing arithmetic prompt is only traversed here, not qualified as bot proof.
    const sum = container.textContent!.match(/(\d+)\s*\+\s*(\d+)\s*=/)!;
    await fill('Security verification answer', String(Number(sum[1]) + Number(sum[2])));
    await submit('step2-form');
    const otpInput = container.querySelector<HTMLInputElement>('#step3-otp-form input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(otpInput, '123456');
      otpInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await submit('step3-otp-form');
    expect(signup).toMatchObject({ password, passwordConfirmation: password, adminName: 'Signup Owner', verificationReceipt: 'controlled-otp-receipt' });
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
