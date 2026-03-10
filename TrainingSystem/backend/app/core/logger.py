import logging
import sys

from app.core.config import settings


def setup_logger() -> logging.Logger:
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    return logging.getLogger(settings.APP_NAME)


logger = setup_logger()
