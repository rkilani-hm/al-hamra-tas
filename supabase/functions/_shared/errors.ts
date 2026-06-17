// Bilingual error envelope + JSON response helpers shared across TAS edge functions.
//
// Every error returned to the client carries BOTH English and Arabic messages so
// the UI can render in the user's locale without a second round-trip.

import { corsHeaders } from "./cors.ts";

export interface ErrorEnvelope {
  code: string;
  message_en: string;
  message_ar: string;
  details?: unknown;
}

// Catalog of known error codes with bilingual copy. Extend as needed.
export const ERRORS: Record<string, { en: string; ar: string }> = {
  METHOD_NOT_ALLOWED: {
    en: "Method not allowed.",
    ar: "الطريقة غير مسموح بها.",
  },
  INVALID_PAYLOAD: {
    en: "The request payload is invalid or incomplete.",
    ar: "حمولة الطلب غير صالحة أو غير مكتملة.",
  },
  IDENTITY_REQUIRED: {
    en: "A valid Entra identity (object id or email) is required.",
    ar: "مطلوب هوية Entra صالحة (معرّف الكائن أو البريد الإلكتروني).",
  },
  USER_INACTIVE: {
    en: "Your account is inactive. Please contact your administrator.",
    ar: "حسابك غير نشط. يرجى التواصل مع المسؤول.",
  },
  SERVER_MISCONFIGURED: {
    en: "The server is misconfigured. Please try again later.",
    ar: "تم إعداد الخادم بشكل غير صحيح. يرجى المحاولة لاحقاً.",
  },
  INTERNAL_ERROR: {
    en: "An unexpected error occurred. Please try again.",
    ar: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
  },
};

// Build a bilingual error envelope from a known code (falls back to INTERNAL_ERROR).
export function buildError(code: string, details?: unknown): ErrorEnvelope {
  const entry = ERRORS[code] ?? ERRORS.INTERNAL_ERROR;
  return {
    code: ERRORS[code] ? code : "INTERNAL_ERROR",
    message_en: entry.en,
    message_ar: entry.ar,
    ...(details !== undefined ? { details } : {}),
  };
}

// JSON success response with CORS headers.
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// JSON error response: wraps a bilingual envelope under { error }.
export function errorResponse(
  code: string,
  status: number,
  details?: unknown,
): Response {
  return jsonResponse({ error: buildError(code, details) }, status);
}
