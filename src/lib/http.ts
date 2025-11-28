import { NextResponse } from 'next/server';

type SuccessPayload<T> = {
  success: true;
  data: T;
};

type ErrorPayload = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function success<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<SuccessPayload<T>>(
    { success: true, data },
    init
  );
}

export function failure(
  code: string,
  message: string,
  options: { status?: number; details?: unknown } = {}
) {
  return NextResponse.json<ErrorPayload>(
    {
      success: false,
      error: { code, message, details: options.details },
    },
    { status: options.status ?? 400 }
  );
}
