"""Exercise the consultative catalog using Chromium and a simulated spreadsheet."""
from pathlib import Path
import shutil
import subprocess
from playwright.sync_api import expect, sync_playwright

root = Path(__file__).resolve().parents[1]
server = subprocess.Popen(['node', 'tests/helpers/coach-browser-server.cjs'], cwd=root, stdout=subprocess.PIPE, text=True)
try:
    base = 'http://127.0.0.1:' + server.stdout.readline().strip()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which('chromium') or p.chromium.executable_path)
        page = browser.new_page(viewport={'width':1440, 'height':900})
        page.add_init_script('window.open = () => null')
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
        errors, actions = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: actions.append(request.post_data_json['request']['action'])
                if request.url.endswith('/rpc') and request.method == 'POST' else None)
        page.goto(base)
        page.locator('#btnLogin').click()
        page.locator('#btnFinishLogin').click()
        expect(page.locator('#appPanel')).to_be_visible()
        expect(page.locator('#itemExercicio option')).to_have_count(11)
        page.locator('#coachInstructions').fill('Manter a sequência do rascunho')
        page.locator('#btnCriarTreino').click()
        expect(page.locator('#cancelCoachSession')).to_be_visible()

        def tables():
            return page.request.post(base+'/test-tables',data={}).json()

        before = tables()
        page.locator('#coachTabLibrary').click()
        page.locator('#libraryGeneralCard').press('Enter')
        areas = ['Musculação','Flexibilidade','Aeróbico','Velocidade','Equilíbrio e coordenação','Exercícios preventivos']
        expect(page.locator('#generalTrainingAreas button')).to_have_text(areas)
        back = page.locator('#libraryBack')
        path = page.locator('#generalCatalogBreadcrumb li')
        expect(back).to_have_text('Voltar à Biblioteca')
        for title in areas[1:]:
            card = page.get_by_role('button', name=title, exact=True)
            card.click()
            expect(page.locator('#generalCatalogTitle')).to_have_text(title)
            expect(page.locator('#generalCatalogStatus')).to_have_text('Conteúdo em preparação.')
            expect(page.locator('#generalExerciseSearch')).to_be_hidden()
            expect(page.locator('#generalCatalogChoices button')).to_have_count(0)
            back.click()
            expect(card).to_be_focused()
        assert 'listGeneralCatalog' not in actions

        page.get_by_role('button', name='Musculação', exact=True).press('Space')
        expect(path).to_have_text(['Treinamento geral','Musculação'])
        groups = {
            'Membros superiores': [('Peitoral',10),('Dorsais',12),('Cintura escapular',16),('Bíceps',8),('Tríceps',8),('Antebraços',10)],
            'Membros inferiores': [('Quadríceps',12),('Isquiotibiais',9),('Glúteos',12),('Adutores',8),('Perna',10),('Pés',12)],
            'Tronco': [('Dinâmicos',27),('Estabilizadores',29)]
        }
        exercises = page.locator('#generalExerciseList li')
        search = page.locator('#generalExerciseSearch')
        seen = []
        for region, categories in groups.items():
            page.get_by_role('button', name=region, exact=True).click()
            expect(path).to_have_text(['Treinamento geral','Musculação',region])
            expect(back).to_have_text('Voltar para Musculação')
            expect(page.locator('#generalCatalogChoices .library-overview-description')).to_have_text(
                [f'{count} exercícios' for _,count in categories])
            for category, count in categories:
                page.get_by_role('button', name=f'{category} {count} exercícios', exact=True).click()
                expect(path).to_have_text(['Treinamento geral','Musculação',region,category])
                expect(path.last).to_have_attribute('aria-current','page')
                expect(exercises).to_have_count(count)
                expect(search).to_have_value('')
                seen.extend(exercises.all_text_contents())
                if category == 'Pés':
                    search.fill('HALUX')
                    expect(exercises).to_have_text([
                        'Elevação isolada do hálux','Flexão resistida do hálux',
                        'Abdução resistida do hálux','Pressão isométrica do hálux'
                    ])
                    expect(page.locator('#generalCatalogStatus')).to_have_text('4 de 12 exercícios')
                    search.fill('supino')
                    expect(exercises).to_have_count(0)
                    expect(page.locator('#generalCatalogStatus')).to_have_text('Nenhum exercício encontrado.')
                    search.fill('')
                    expect(exercises).to_have_count(12)
                    for width in [1440,900,390,320]:
                        page.set_viewport_size({'width':width,'height':900})
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
                back.click()
                expect(page.locator('#generalCatalogTitle')).to_have_text(region)
            back.click()
            expect(page.locator('#generalCatalogTitle')).to_have_text('Musculação')
        assert len(seen) == len(set(seen)) == 183

        page.locator('#coachTabBuild').click()
        expect(page.locator('#cancelCoachSession')).to_be_visible()
        expect(page.locator('#coachInstructions')).to_have_value('Manter a sequência do rascunho')
        expect(page.locator('#itemExercicio option')).to_have_count(11)
        page.locator('#coachTabLibrary').click()
        expect(page.locator('#generalCatalogTitle')).to_have_text('Musculação')
        back.click()
        expect(page.locator('#generalStrength')).to_be_focused()
        back.click()
        expect(page.locator('#libraryGeneralCard')).to_be_focused()
        assert actions.count('listGeneralCatalog') == 1
        assert tables() == before
        assert not errors, errors
        print('PASS: six areas, all 14 categories and 183 exercises, accent-insensitive category search, responsive layout, back navigation and preserved draft/tables')
finally:
    server.terminate()
    server.wait(timeout=10)
