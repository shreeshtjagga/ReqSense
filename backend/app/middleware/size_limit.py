import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette import status

logger = logging.getLogger(__name__)

DEFAULT_MAX_BODY_BYTES = 15 * 1024 * 1024

class ContentLengthLimitMiddleware(BaseHTTPMiddleware):
    """
    Guards the server against memory exhaustion and large payload DoS attacks
    by checking incoming Content-Length headers before reading the body.
    """

    def __init__(self, app, max_body_bytes: int = DEFAULT_MAX_BODY_BYTES):
        super().__init__(app)
        self.max_body_bytes = max_body_bytes

    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    length = int(content_length)
                    if length > self.max_body_bytes:
                        logger.warning(
                            "Rejected payload exceeding size limit: %d bytes (limit: %d bytes) for %s %s",
                            length,
                            self.max_body_bytes,
                            request.method,
                            request.url.path,
                        )
                        return JSONResponse(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            content={
                                "error": {
                                    "code": "PAYLOAD_TOO_LARGE",
                                    "message": f"Request payload exceeds maximum permitted size of {self.max_body_bytes // (1024 * 1024)} MB.",
                                }
                            },
                        )
                except ValueError:
                    pass

        return await call_next(request)
