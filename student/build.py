"""Generate demo + Google student builds, retaining the maintained source files."""
from pathlib import Path
import re, base64
root=Path(__file__).resolve().parent.parent
html=(root/'student/template.html').read_text()
css=(root/'student/style.css').read_text()
model=(root/'student/model.js').read_text();app=(root/'student/app.js').read_text()
base=html.replace('/*MODEL*/',model).replace('/*APP*/',app)
demo_backend=re.search(r'<script>([\s\S]*?)</script>',(root/'demo/index.html').read_text())[1]
controls='''<aside class="demo-strip"><strong>DEMONSTRAÇÃO</strong><span>Dados fictícios • sem conexão com Google</span><label class="sr-only" for="demoProfile">Perfil de demonstração</label><select id="demoProfile"><option value="hom-student-a">Aluna A Demo</option><option value="hom-student-b">Aluno B Demo</option><option value="hom-student-empty">Sem treinos</option></select><button id="resetDemo">Reiniciar</button><a href="coach.html">Treinador ↗</a></aside>'''
fonts=(root/'student/assets/fonts.css').read_text()
fonts=re.sub(r'url\(([^)]+)\)',r'url(assets/\1)',fonts)
demo=base.replace('/*STYLES*/',fonts+css).replace('<!--DEMO_CONTROLS-->',controls).replace('/*ADAPTER*/',demo_backend+'\n'+(root/'student/demo-adapter.js').read_text()).replace('@@COACH_URL@@','coach.html')
(root/'demo/student.html').write_text(demo)
# Apps Script HtmlService has no static asset directory: embed the hero, use sans-serif fallback.
photo=base64.b64encode((root/'student/assets/climbing.jpg').read_bytes()).decode()
google_css=css.replace('assets/climbing.jpg','data:image/jpeg;base64,'+photo)
google=base.replace('/*STYLES*/',google_css).replace('<!--DEMO_CONTROLS-->','').replace('/*ADAPTER*/',(root/'student/google-adapter.js').read_text())
(root/'apps-script/Student.html').write_text(google)
print('demo/student.html and apps-script/Student.html generated')
