from typing import Any

from fastapi.responses import JSONResponse


def success_response(data: Any = None, message: str = "success") -> dict:
    return {"code": "OK", "message": message, "data": data}


def error_response(code: str, message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "data": None},
    )


def paginated_response(items: list, total: int, page: int, page_size: int) -> dict:
    return success_response(
        data={"items": items, "total": total, "page": page, "page_size": page_size}
    )
