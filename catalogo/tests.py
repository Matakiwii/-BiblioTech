from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Autor, Libro, Prestamo


class BibliotecaViewsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.user = user_model.objects.create_user(
            username='lectora',
            password='A-test-password-123!',
        )
        cls.staff = user_model.objects.create_user(
            username='admin',
            password='A-test-password-123!',
            is_staff=True,
        )
        cls.autor = Autor.objects.create(nombre='Gabriela Mistral')
        cls.libro = Libro.objects.create(
            autor=cls.autor,
            titulo='Desolación',
            anio=1922,
            ejemplares_disponibles=1,
            destacado=True,
        )

    def test_home_displays_featured_published_books(self):
        response = self.client.get(reverse('catalogo:portada'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Desolación')

    def test_search_matches_title_or_author(self):
        response = self.client.get(
            reverse('catalogo:buscar'),
            {'q': 'Mistral'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Desolación')

    def test_loan_request_decrements_available_copies(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('catalogo:solicitar', args=[self.libro.pk]),
        )

        self.assertRedirects(
            response,
            reverse('catalogo:detalle', args=[self.libro.pk]),
        )
        self.libro.refresh_from_db()
        self.assertEqual(self.libro.ejemplares_disponibles, 0)
        self.assertTrue(
            Prestamo.objects.filter(
                libro=self.libro,
                usuario=self.user,
            ).exists()
        )

    def test_loan_request_does_not_decrement_below_zero(self):
        Libro.objects.filter(pk=self.libro.pk).update(
            ejemplares_disponibles=0,
        )
        self.client.force_login(self.user)

        self.client.post(reverse('catalogo:solicitar', args=[self.libro.pk]))

        self.libro.refresh_from_db()
        self.assertEqual(self.libro.ejemplares_disponibles, 0)
        self.assertFalse(Prestamo.objects.exists())

    def test_loan_request_requires_login(self):
        response = self.client.post(
            reverse('catalogo:solicitar', args=[self.libro.pk]),
        )

        self.assertRedirects(
            response,
            f'{reverse("login")}?next={reverse("catalogo:solicitar", args=[self.libro.pk])}',
        )

    def test_book_management_is_limited_to_staff(self):
        self.client.force_login(self.user)
        self.assertEqual(
            self.client.get(reverse('catalogo:crear')).status_code,
            403,
        )

        self.client.force_login(self.staff)
        self.assertEqual(
            self.client.get(reverse('catalogo:crear')).status_code,
            200,
        )
