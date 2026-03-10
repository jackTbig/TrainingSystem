from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.logger import logger
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("应用启动中...")
    yield
    logger.info("应用关闭中...")
    await engine.dispose()
