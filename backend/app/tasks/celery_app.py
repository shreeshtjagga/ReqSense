"""
Local Celery stub — replaces the Redis-backed Celery broker.

task.delay(**kwargs) calls the function directly and synchronously.
This removes the need for a running Celery worker or Redis broker in
local development mode.
"""
import logging

logger = logging.getLogger(__name__)


class _DirectTask:
    """Wraps a plain function so .delay() calls it synchronously."""

    def __init__(self, func, name: str = ""):
        self._func = func
        self.name = name or getattr(func, "__name__", "unknown_task")

    def __call__(self, *args, **kwargs):
        return self._func(*args, **kwargs)

    def delay(self, *args, **kwargs):
        logger.debug("[LOCAL TASK] Running %s directly (no worker)", self.name)
        try:
            return self._func(*args, **kwargs)
        except Exception as exc:
            logger.error("[LOCAL TASK] %s failed: %s", self.name, exc)
            raise

    def apply_async(self, args=None, kwargs=None, **options):
        return self.delay(*(args or []), **(kwargs or {}))


class _FakeCelery:
    """Minimal Celery-compatible stub for local/no-broker operation."""

    def __init__(self, name: str, **kwargs):
        self._name = name
        self.conf = type("Conf", (), {"update": lambda self, *a, **kw: None})()

    def task(self, *args, name: str = "", **kwargs):
        """Decorator: @celery_app.task(...) or @celery_app.task"""
        def _decorator(func):
            task_name = name or f"{func.__module__}.{func.__name__}"
            return _DirectTask(func, name=task_name)

        # Called as @celery_app.task (no parentheses)
        if len(args) == 1 and callable(args[0]):
            return _decorator(args[0])
        # Called as @celery_app.task(...) with arguments
        return _decorator

    def autodiscover_tasks(self, packages):
        pass

    def connection(self):
        class _FakeConn:
            def connect(self): pass
            def release(self): pass
        return _FakeConn()


celery_app = _FakeCelery("reqsense")
