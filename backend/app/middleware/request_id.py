"""
Request-ID middleware.

Injects a unique X-Request-ID header on every request/response.
If the client sends one, it is propagated unchanged (useful for tracing
calls from the frontend). Otherwise a new UUID4 is generated.

The request_id is also stored in a context variable so services and the
audit log can read it without threading it through every function call.
"""

import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_CTX: ContextVar[str] = ContextVar("request_id", default="")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = REQUEST_ID_CTX.set(request_id)
        try:
            response = await call_next(request)
        finally:
            REQUEST_ID_CTX.reset(token)

        response.headers["X-Request-ID"] = request_id
        return response


def get_request_id() -> str:
    """Return the current request ID from context (empty string outside a request)."""
    return REQUEST_ID_CTX.get()
