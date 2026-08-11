import uuid
from contextvars import ContextVar

import sentry_sdk
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_CTX: ContextVar[str] = ContextVar("request_id", default="")

_SECURITY_HEADERS: dict[str, str] = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    ),
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
}

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = REQUEST_ID_CTX.set(request_id)

        try:
            sentry_sdk.set_tag("request_id", request_id)
        except Exception:
            pass

        try:
            response = await call_next(request)
        finally:
            REQUEST_ID_CTX.reset(token)

        response.headers["X-Request-ID"] = request_id

        for header, value in _SECURITY_HEADERS.items():
            response.headers[header] = value

        return response

def get_request_id() -> str:
    return REQUEST_ID_CTX.get()
