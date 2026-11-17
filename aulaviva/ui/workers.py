"""Execução de tarefas pesadas fora da thread da interface."""

from __future__ import annotations

import logging
from typing import Any, Callable

from PySide6.QtCore import QObject, QRunnable, QThreadPool, Signal

log = logging.getLogger(__name__)
_alive: set = set()


class _Signals(QObject):
    done = Signal(object)
    failed = Signal(object)


class _Task(QRunnable):
    def __init__(self, fn: Callable[[], Any]):
        super().__init__()
        self.fn = fn
        self.signals = _Signals()
        self.setAutoDelete(True)

    def run(self):
        try:
            result = self.fn()
        except Exception as exc:  # repassa para a interface tratar
            log.info("Tarefa em segundo plano falhou: %s", type(exc).__name__)
            self.signals.failed.emit(exc)
        else:
            self.signals.done.emit(result)


def run_async(fn: Callable[[], Any], on_done: Callable[[Any], None] | None = None,
              on_error: Callable[[Exception], None] | None = None) -> None:
    task = _Task(fn)
    sig = task.signals
    _alive.add(sig)

    def finish(cb, value):
        _alive.discard(sig)
        if cb:
            cb(value)

    sig.done.connect(lambda r: finish(on_done, r))
    sig.failed.connect(lambda e: finish(on_error, e))
    QThreadPool.globalInstance().start(task)
