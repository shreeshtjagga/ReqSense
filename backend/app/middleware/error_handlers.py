"""
Standard error envelope middleware + exception handlers.

Every error response from the API has this shape:
{
    "error": {
        "code": "VALIDATION_ERROR",       # machine-readable
        "message": "...",                  # human-readable
        "request_id": "uuid",
        "detail": [...]                    # optional, e.g. pydantic field errors
    }
}

This means the frontend always knows exactly where to find the error message
and request_id regardless of which endpoint produced the error.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.middleware.request_id import get_request_id

logger = logging.getLogger(__name__)


def _error_envelope(
    code: str,
    message: str,
    request_id: str,
    detail: Any = None,
) -> dict:
    body: dict = {"code": code, "message": message, "request_id": request_id}
    if detail is not None:
        body["detail"] = detail
    return {"error": body}


def register_error_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the FastAPI app."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        request_id = get_request_id()
        # Map common HTTP codes to machine-readable codes
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
            429: "RATE_LIMITED",
            500: "INTERNAL_SERVER_ERROR",
        }
        code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(
                code=code,
                message=str(exc.detail),
                request_id=request_id,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = get_request_id()
        # Pydantic v2 errors() can contain non-serializable objects (ValueError);
        # convert each error's 'ctx' values to strings for safe JSON encoding.
        safe_errors = []
        for err in exc.errors():
            safe_err = dict(err)
            if "ctx" in safe_err and safe_err["ctx"]:
                safe_err["ctx"] = {k: str(v) for k, v in safe_err["ctx"].items()}
            safe_errors.append(safe_err)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_envelope(
                code="VALIDATION_ERROR",
                message="Request validation failed.",
                request_id=request_id,
                detail=safe_errors,
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        request_id = get_request_id()
        logger.exception(
            "Unhandled exception [request_id=%s] %s %s",
            request_id,
            request.method,
            request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_envelope(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected error occurred. Please try again later.",
                request_id=request_id,
            ),
        )
