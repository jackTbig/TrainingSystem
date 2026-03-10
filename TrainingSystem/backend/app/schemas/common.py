from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ResponseSchema(BaseModel, Generic[T]):
    code: str = "OK"
    message: str = "success"
    data: T | None = None


class PaginatedData(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class PaginatedResponseSchema(BaseModel, Generic[T]):
    code: str = "OK"
    message: str = "success"
    data: PaginatedData[T] | None = None


class PageParams(BaseModel):
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
