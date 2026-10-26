"""Gera as spritesheets do jogo a partir do pacote Kenney "Top-down Shooter" (CC0).

Uso: python tools/gerar_arte.py <pasta do pacote descompactado>   (ex.: .../kenney_top-down-shooter)
Precisa de Pillow. Escreve em src/assets/ com os mesmos nomes que o jogo já carrega.

O pacote traz uma imagem por pose (personagem virado para a direita). Aqui rotacionamos para o jogo
(jogador olha para cima, zumbi olha para baixo) e montamos os quadros de caminhada e de morte.
"""
import colorsys
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "src" / "assets"
FONTE = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"   # DejaVu: licença livre (Bitstream Vera)
FRAME = 100          # lado de cada quadro nas spritesheets (o jogo carrega com frameWidth: 100)
ESCALA = 2           # os sprites do pacote têm ~43 px de altura; dobramos para caber no quadro de 100


def pose(pacote: Path, pasta: str, arquivo: str) -> Image.Image:
    im = Image.open(pacote / "PNG" / pasta / arquivo).convert("RGBA")
    return im.resize((im.width * ESCALA, im.height * ESCALA), Image.LANCZOS)


def trocar_matiz(im: Image.Image, deslocamento: float) -> Image.Image:
    """Zombie 2 = zumbi 1 com a cor girada, só para variar visualmente."""
    r, g, b, a = im.split()
    h, s, v = Image.merge("RGB", (r, g, b)).convert("HSV").split()
    h = h.point(lambda x: int((x + deslocamento * 255) % 256))
    return Image.merge("RGBA", (*Image.merge("HSV", (h, s, v)).convert("RGB").split(), a))


def quadro(im: Image.Image, graus: float = 0, dx: int = 0, dy: int = 0,
           escala: float = 1.0, alfa: float = 1.0, sangue: float = 0.0) -> Image.Image:
    """Um quadro 100x100: gira em torno do centro, escala, esmaece e tinge de vermelho."""
    if escala != 1.0:
        im = im.resize((max(1, int(im.width * escala)), max(1, int(im.height * escala))), Image.LANCZOS)
    im = im.rotate(graus, expand=True, resample=Image.BICUBIC)
    if sangue > 0:
        vermelho = Image.new("RGBA", im.size, (150, 0, 0, 255))
        misto = Image.blend(im, vermelho, sangue)
        misto.putalpha(im.getchannel("A"))
        im = misto
    if alfa < 1.0:
        im.putalpha(im.getchannel("A").point(lambda x: int(x * alfa)))
    tela = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    tela.alpha_composite(im, ((FRAME - im.width) // 2 + dx, (FRAME - im.height) // 2 + dy))
    return tela


def folha(quadros: list[Image.Image], nome: str) -> None:
    tira = Image.new("RGBA", (FRAME * len(quadros), FRAME), (0, 0, 0, 0))
    for i, q in enumerate(quadros):
        tira.paste(q, (i * FRAME, 0))
    tira.save(SAIDA / "spritesheets" / nome)


def morte(base: Image.Image, giro: int) -> list[Image.Image]:
    """4 quadros: cai girando, encolhe, esmaece e fica vermelho."""
    return [quadro(base, graus=giro * i, escala=1 - 0.08 * i, alfa=1 - 0.2 * i, sangue=0.25 * i) for i in range(4)]


def coracao() -> Image.Image:
    g = 8                                   # desenha 8x maior e reduz, para ficar suave
    im = Image.new("RGBA", (16 * g, 16 * g), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    vermelho = (220, 30, 50, 255)
    d.ellipse((1 * g, 2 * g, 8.5 * g, 9.5 * g), fill=vermelho)
    d.ellipse((7.5 * g, 2 * g, 15 * g, 9.5 * g), fill=vermelho)
    d.polygon([(1.4 * g, 6.5 * g), (14.6 * g, 6.5 * g), (8 * g, 15 * g)], fill=vermelho)
    return im.resize((16, 16), Image.LANCZOS)


def tiro() -> Image.Image:
    """Duas versões de 8x100 (o jogo carrega frameWidth: 8): rastro amarelo de 6 px que esmaece para baixo.
    6 px de largura (e não 2) para o detector conseguir enxergar o tiro em uma imagem de 640 px."""
    im = Image.new("RGBA", (16, FRAME), (0, 0, 0, 0))
    for quadro_i, comprimento in enumerate((34, 42)):
        x0 = quadro_i * 8
        for y in range(comprimento):
            a = int(255 * (1 - y / comprimento))
            for x in range(1, 7):
                nucleo = 3 <= x <= 4
                cor = (255, 255, 235) if nucleo else (255, 205, 70)
                im.putpixel((x0 + x, y), (*cor, a if nucleo else int(a * 0.8)))
    return im


def fundo(pacote: Path) -> Image.Image:
    """Chão escuro: ladrilhos verdes do pacote, escurecidos e com borda mais escura (clima noturno)."""
    random.seed(7)
    tela = Image.new("RGB", (512, 544))
    ladrilhos = [Image.open(pacote / "PNG" / "Tiles" / f"tile_0{n}.png").convert("RGB") for n in (1, 2, 3)]
    for y in range(0, 544, 64):
        for x in range(0, 512, 64):
            tela.paste(random.choice(ladrilhos), (x, y))
    tela = ImageEnhance.Brightness(tela).enhance(0.45)
    # vinheta radial: o centro fica como está e as bordas escurecem de forma suave
    vinheta = Image.radial_gradient("L").resize(tela.size, Image.BICUBIC).point(lambda x: int(min(255, x * 1.15)))
    return Image.composite(Image.new("RGB", tela.size, (4, 10, 6)), tela, vinheta.point(lambda x: int(x * 0.8)))


def logo() -> Image.Image:
    """Título 400x200: duas linhas em vermelho com contorno escuro."""
    im = Image.new("RGBA", (400, 200), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fonte = ImageFont.truetype(FONTE, 66)
    for linha, y in (("ZOMBIE", 25), ("ATTACK", 100)):
        largura = d.textlength(linha, font=fonte)
        d.text(((400 - largura) / 2, y), linha, font=fonte, fill=(200, 15, 15, 255),
               stroke_width=4, stroke_fill=(50, 0, 0, 255))
    return im


def fonte_bitmap() -> None:
    """Fonte bitmap no formato BMFont (o Phaser lê png + xml): ASCII 32..126 em uma grade."""
    tam = 32
    fonte = ImageFont.truetype(FONTE, tam)
    ascent, descent = fonte.getmetrics()
    altura = ascent + descent
    colunas, margem = 10, 3
    celula_l, celula_a = int(fonte.getlength("M")) + 2 * margem, altura + 2 * margem
    codigos = range(32, 127)
    linhas = -(-len(codigos) // colunas)
    folha_im = Image.new("RGBA", (colunas * celula_l, linhas * celula_a), (0, 0, 0, 0))
    d = ImageDraw.Draw(folha_im)
    chars = []
    for i, c in enumerate(codigos):
        x, y = (i % colunas) * celula_l, (i // colunas) * celula_a
        d.text((x + margem, y + margem), chr(c), font=fonte, fill=(255, 255, 255, 255))
        chars.append(f'    <char id="{c}" x="{x + margem}" y="{y + margem}" width="{int(fonte.getlength(chr(c)))}" '
                     f'height="{altura}" xoffset="0" yoffset="0" xadvance="{int(fonte.getlength(chr(c)))}" page="0" chnl="15"/>')
    (SAIDA / "font").mkdir(parents=True, exist_ok=True)
    folha_im.save(SAIDA / "font" / "font.png")
    xml = (f'<font>\n  <info face="DejaVu Sans Mono Bold" size="{tam}" bold="1" italic="0" charset="" unicode="" '
           f'stretchH="100" smooth="1" aa="1" padding="0,0,0,0" spacing="0,0" outline="0"/>\n'
           f'  <common lineHeight="{altura}" base="{ascent}" scaleW="{folha_im.width}" scaleH="{folha_im.height}" pages="1" packed="0"/>\n'
           f'  <pages>\n    <page id="0" file="font.png"/>\n  </pages>\n  <chars count="{len(chars)}">\n'
           + "\n".join(chars) + "\n  </chars>\n</font>\n")
    (SAIDA / "font" / "font.xml").write_text(xml, encoding="utf-8")


def main(pacote: Path) -> None:
    (SAIDA / "spritesheets").mkdir(parents=True, exist_ok=True)
    (SAIDA / "images").mkdir(parents=True, exist_ok=True)

    # zumbi: pacote vira para a direita; o do jogo desce a tela (olha para baixo) => gira -90
    zb1 = {p: pose(pacote, "Zombie 1", f"zoimbie1_{p}.png") for p in ("stand", "hold")}
    zb2 = {p: trocar_matiz(im, 0.30) for p, im in zb1.items()}
    for n, zb in ((1, zb1), (2, zb2)):
        base = zb["hold"].rotate(-90, expand=True)
        folha([quadro(zb[("stand", "hold", "stand", "hold")[i]].rotate(-90, expand=True),
                      graus=(-6, 0, 6, 0)[i], dy=(-2, 2, -2, 2)[i]) for i in range(4)], f"zombie{n}-move.png")
        folha(morte(base, 25), f"zombie{n}-die.png")

    # civil (a mulher que precisa ser salva): mesma ideia do zumbi, desce a tela virada para baixo, cores originais
    civil = {p: pose(pacote, "Woman Green", f"womanGreen_{p}.png").rotate(-90, expand=True) for p in ("stand", "hold")}
    folha([quadro(civil[("stand", "hold", "stand", "hold")[i]], graus=(-6, 0, 6, 0)[i], dy=(-2, 2, -2, 2)[i])
           for i in range(4)], "civilian-move.png")
    folha(morte(civil["hold"], 25), "civilian-die.png")

    # jogador: olha para cima => gira +90
    arma = {p: pose(pacote, "Survivor 1", f"survivor1_{p}.png").rotate(90, expand=True)
            for p in ("gun", "machine", "reload", "stand")}
    folha([quadro(arma["gun"], dy=-2), quadro(arma["machine"], dy=2)], "player-move.png")
    folha([quadro(arma[p]) for p in ("gun", "machine", "reload", "gun")], "player-shot.png")
    folha(morte(arma["stand"], -30), "player-die.png")

    tiro().save(SAIDA / "spritesheets" / "shot2.png")
    coracao().save(SAIDA / "images" / "life.png")
    fundo(pacote).save(SAIDA / "images" / "background.jpg", quality=90)
    logo().save(SAIDA / "images" / "logo.png")
    fonte_bitmap()
    print("arte gerada em", SAIDA)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
