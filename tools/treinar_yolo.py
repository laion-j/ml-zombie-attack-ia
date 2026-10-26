"""Treina o YOLOv5n no dataset gerado por coletar_dataset.mjs, partindo dos pesos do COCO (fine-tuning).

Uso (da raiz do projeto): ml/.venv-yolo/bin/python tools/treinar_yolo.py [argumentos do train.py do YOLOv5]
Exemplo: ... tools/treinar_yolo.py --epochs 30 --batch 16
Os pesos finais ficam em ml/runs/zombie/weights/best.pt.
"""
import runpy
import sys

import yolo_compat

yolo_compat.preparar()

args = sys.argv[1:]
padrao = {"--img": "640", "--data": "ml/dataset/data.yaml", "--weights": "yolov5n.pt",
          "--project": "ml/runs", "--name": "zombie", "--workers": "4"}
for opcao, valor in padrao.items():
    if opcao not in args:
        args += [opcao, valor]
if "--exist-ok" not in args:
    args.append("--exist-ok")
sys.argv = [str(yolo_compat.YOLO / "train.py")] + args
runpy.run_path(str(yolo_compat.YOLO / "train.py"), run_name="__main__")
