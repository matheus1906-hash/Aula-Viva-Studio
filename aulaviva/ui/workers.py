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


# ---------------------------------------------------------------------------
# Processo auxiliar para tarefas pesadas em Python puro (geração de PDF).
# Em uma thread elas disputariam o GIL com a interface e causariam travadas;
# num processo separado a interface continua 100% fluida.
# ---------------------------------------------------------------------------
_executor = None
_proc_broken = False


def _get_executor():
    global _executor
    if _executor is None:
        import atexit
        import multiprocessing
        from concurrent.futures import ProcessPoolExecutor

        _executor = ProcessPoolExecutor(max_workers=1, mp_context=multiprocessing.get_context("spawn"))
        atexit.register(lambda: _executor.shutdown(wait=False, cancel_futures=True))
    return _executor


def warm_up_process() -> None:
    """Inicia o processo auxiliar antecipadamente (a 1ª prévia fica instantânea)."""
    if not _proc_broken:
        try:
            _get_executor().submit(_noop)
        except Exception:
            pass


def _noop():
    import aulaviva.core.pdf_builder  # noqa: F401  (pré-carrega o ReportLab no processo auxiliar)
    return True


def run_in_process(fn: Callable, *args, on_done: Callable[[Any], None] | None = None,
                   on_error: Callable[[Exception], None] | None = None) -> None:
    """Executa fn(*args) em outro processo; callbacks rodam na thread da interface.

    fn precisa ser uma função de módulo (importável). Se o processo auxiliar falhar,
    cai automaticamente para uma thread.
    """
    global _proc_broken
    if _proc_broken:
        run_async(lambda: fn(*args), on_done, on_error)
        return
    sig = _Signals()
    _alive.add(sig)

    def finish(cb, value):
        _alive.discard(sig)
        if cb:
            cb(value)

    sig.done.connect(lambda r: finish(on_done, r))
    sig.failed.connect(lambda e: finish(on_error, e))
    try:
        future = _get_executor().submit(fn, *args)
    except Exception:
        _proc_broken = True
        _alive.discard(sig)
        run_async(lambda: fn(*args), on_done, on_error)
        return

    def done(fut):
        global _proc_broken
        try:
            sig.done.emit(fut.result())
        except Exception as exc:
            from concurrent.futures.process import BrokenProcessPool

            if isinstance(exc, BrokenProcessPool):
                _proc_broken = True
                log.warning("Processo auxiliar indisponível; usando threads.")
                run_async(lambda: fn(*args), on_done, on_error)
                _alive.discard(sig)
                return
            sig.failed.emit(exc)

    future.add_done_callback(done)
