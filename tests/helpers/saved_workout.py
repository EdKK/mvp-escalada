"""Seed a saved session for browser regressions of the existing item workflow."""
from playwright.sync_api import expect


def select_saved_workout(page, base):
    def field(name):
        return page.locator('#' + name)

    data = {
        'studentId': field('coachAluno').input_value(),
        'date': field('coachData').input_value(),
        'microcycleType': field('coachMicrocycleType').input_value(),
        'instructions': field('coachInstructions').input_value().splitlines(),
    }
    result = page.request.post(base + '/test-saved-workout', data=data).json()
    assert result['ok'], result
    page.get_by_role('button', name='Atualizar treinos').click()
    field('listaTreinos').get_by_role('button', name=f"{data['date']} • {data['studentId']} • {data['microcycleType']}", exact=True).click()
    expect(field('coachTreinoId')).to_have_value(result['data']['id'])
