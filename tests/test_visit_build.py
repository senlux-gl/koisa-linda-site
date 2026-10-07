"""The published party-dress journey must expose the right physical store."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class VisitBuildTest(unittest.TestCase):
    maxDiff = 1000
    def page(self, name):
        return (ROOT / '_site' / name).read_text()

    def test_catalog_exposes_both_addresses_and_free_visit(self):
        page = self.page('catalogo/index.html')
        self.assertIn('Não precisa agendar.', page)
        self.assertIn('Endereços e horários · Barra e Niterói', page)
        for store in json.loads((ROOT / 'kl-visit-stores.json').read_text()).values():
            self.assertIn(store['address'], page)
            self.assertIn(store['hours'], page)
        self.assertIn('/kl-visit-free.js', page)

    def test_static_festa_piece_exposes_its_own_store(self):
        for code, unit in [('MD-001', 'barra'), ('080950', 'sf')]:
            with self.subTest(code=code):
                page = self.page('p/' + code + '.html')
                self.assertIn('id="kl-visit-' + unit + '"', page)
                other = 'sf' if unit == 'barra' else 'barra'
                self.assertNotIn('id="kl-visit-' + other + '"', page)
                self.assertIn('Não precisa agendar.', page)

    def test_high_ticket_keeps_booking_and_no_festa_notice(self):
        for name in ['noivas/index.html', 'debutantes/index.html', 'p/NV-001.html']:
            with self.subTest(name=name):
                page = self.page(name)
                self.assertNotIn('id="kl-festa-visita"', page)
                self.assertIn('/agendar/?', page)

    def test_main_journey_footer_repeats_store_directions(self):
        for name in ['index.html', 'catalogo/index.html', 'madrinhas/index.html',
                     'prova-virtual/index.html', 'peca/index.html', 'unidades/index.html']:
            with self.subTest(name=name):
                page = self.page(name)
                self.assertTrue('class="kl-footer-stores"' in page, name + ': store footer missing')
                self.assertTrue('Vestidos de festa: venha sem agendar' in page, name + ': free visit missing')
                self.assertTrue('Noivas e debutantes: agende sua prova.' in page, name + ': booking distinction missing')


if __name__ == '__main__':
    unittest.main()
