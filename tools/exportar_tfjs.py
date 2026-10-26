"""Converte os pesos treinados (.pt) para TensorFlow.js, com o NMS dentro do modelo (mesmo formato do modelo da aula).

Uso: ml/.venv-tfjs/bin/python tools/exportar_tfjs.py [caminho do .pt]    (padrão: ml/runs/zombie/weights/best.pt)
Saída: pasta ao lado do .pt chamada best_web_model/ (model.json + .bin); copie para src/ml/modelo/.
"""
import os
import runpy
import sys

os.environ["TF_USE_LEGACY_KERAS"] = "1"   # tf_keras (Keras 2): é o que o conversor do TFJS entende
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["YOLOv5_AUTOINSTALL"] = "False"   # o YOLOv5 reinstalaria pacotes sozinho e desfaria as versões fixadas (protobuf)

import yolo_compat  # noqa: E402

yolo_compat.preparar()
pesos = sys.argv[1] if len(sys.argv) > 1 else "ml/runs/zombie/weights/best.pt"
sys.argv = [str(yolo_compat.YOLO / "export.py"), "--weights", pesos, "--include", "tfjs", "--img", "640", "--device", "cpu"]
runpy.run_path(str(yolo_compat.YOLO / "export.py"), run_name="__main__")
