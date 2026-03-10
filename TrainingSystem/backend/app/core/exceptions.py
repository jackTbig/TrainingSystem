from fastapi import Request
from fastapi.responses import JSONResponse


class BusinessException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class AuthException(BusinessException):
    def __init__(self, code: str = "AUTH_UNAUTHORIZED", message: str = "未授权"):
        super().__init__(code=code, message=message, status_code=401)


class PermissionException(BusinessException):
    def __init__(self, code: str = "PERMISSION_DENIED", message: str = "权限不足"):
        super().__init__(code=code, message=message, status_code=403)


class NotFoundException(BusinessException):
    def __init__(self, code: str = "NOT_FOUND", message: str = "资源不存在"):
        super().__init__(code=code, message=message, status_code=404)


async def business_exception_handler(request: Request, exc: BusinessException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message, "data": None},
    )
