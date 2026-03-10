"""RabbitMQ 消息发布工具（aio-pika）"""
import json
import logging
from typing import Any

import aio_pika

from app.core.config import settings

logger = logging.getLogger(__name__)

# 队列名称常量
QUEUE_DOCUMENT_PARSE = "document.parse"
QUEUE_COURSE_GENERATE = "course.generate"
QUEUE_QUESTION_GENERATE = "question.generate"


async def publish(queue_name: str, payload: dict[str, Any]) -> None:
    """向指定队列发布一条持久化消息（fire-and-forget）。"""
    try:
        connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        async with connection:
            channel = await connection.channel()
            queue = await channel.declare_queue(queue_name, durable=True)
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(payload).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=queue.name,
            )
            logger.info("Published to %s: %s", queue_name, payload)
    except Exception as exc:
        logger.error("Failed to publish to %s: %s", queue_name, exc)
