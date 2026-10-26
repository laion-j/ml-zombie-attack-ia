"""Ajustes para rodar o YOLOv5 v7.0 (ml/yolov5) com PyTorch 2.6 e NumPy 2. Importado pelos lançadores em tools/.

- PyTorch 2.6 carrega checkpoints com weights_only=True. O .pt do YOLOv5 guarda o modelo inteiro (classes do YOLOv5);
  em vez de desligar a proteção (weights_only=False executa código do arquivo), liberamos só as classes do próprio
  YOLOv5 e do torch.nn, que são as únicas que o checkpoint precisa.
- Pillow 10 removeu FreeTypeFont.getsize, que o YOLOv5 usa para desenhar os rótulos nas imagens de diagnóstico.
- NumPy 2 removeu np.trapz, que o YOLOv5 usa no cálculo do AP (o substituto é np.trapezoid).
"""
import inspect
import os
import sys
from pathlib import Path

import numpy as np
import torch

RAIZ = Path(__file__).resolve().parent.parent
YOLO = RAIZ / "ml" / "yolov5"


def preparar() -> None:
    sys.path.insert(0, str(YOLO))
    os.chdir(RAIZ)
    if not hasattr(np, "trapz"):
        np.trapz = np.trapezoid
    from PIL import ImageFont
    if not hasattr(ImageFont.FreeTypeFont, "getsize"):
        def getsize(self, texto, *args, **kwargs):
            esq, topo, dir_, base = self.getbbox(texto, *args, **kwargs)
            return dir_ - esq, base - topo
        ImageFont.FreeTypeFont.getsize = getsize

    import models.common
    import models.yolo
    import torch.nn.modules as nn_modules
    import torch.nn.modules.container as nn_container

    def classes(modulo):
        raiz = modulo.__name__.split(".")[0]
        return [c for _, c in inspect.getmembers(modulo, inspect.isclass) if c.__module__.startswith(raiz)]

    # os checkpoints que o próprio treino grava também trazem arrays do NumPy (métricas e resultados)
    numpy_seguro = [np.ndarray, np.dtype, np.core.multiarray._reconstruct, np.core.multiarray.scalar] + [
        c for _, c in inspect.getmembers(np.dtypes, inspect.isclass) if c.__name__.endswith("DType")]

    # o checkpoint se refere ao modelo como "models.yolo.Model", que no código atual é um apelido de DetectionModel
    torch.serialization.add_safe_globals(
        classes(models.common) + classes(models.yolo) + classes(nn_modules) + classes(nn_container)
        + numpy_seguro + [(models.yolo.DetectionModel, "models.yolo.Model")]
    )
