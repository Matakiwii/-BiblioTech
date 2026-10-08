from datetime import timedelta

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone

from .admin import PrestamoAdmin
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
            {'tipo': Prestamo.TipoPrestamo.NORMAL},
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
                tipo=Prestamo.TipoPrestamo.NORMAL,
            ).exists()
        )

    def test_normal_loan_expires_after_seven_days(self):
        self.client.force_login(self.user)

        self.client.post(
            reverse('catalogo:solicitar', args=[self.libro.pk]),
            {'tipo': Prestamo.TipoPrestamo.NORMAL},
        )

        prestamo = Prestamo.objects.get(usuario=self.user)
        duracion = prestamo.fecha_vencimiento - prestamo.fecha_solicitud
        self.assertGreater(duracion, timedelta(days=7) - timedelta(seconds=1))
        self.assertLessEqual(duracion, timedelta(days=7))

    def test_reservation_loan_expires_after_two_hours(self):
        self.client.force_login(self.user)

        self.client.post(
            reverse('catalogo:solicitar', args=[self.libro.pk]),
            {'tipo': Prestamo.TipoPrestamo.RESERVA},
        )

        prestamo = Prestamo.objects.get(usuario=self.user)
        duracion = prestamo.fecha_vencimiento - prestamo.fecha_solicitud
        self.assertEqual(prestamo.tipo, Prestamo.TipoPrestamo.RESERVA)
        self.assertGreater(duracion, timedelta(hours=2) - timedelta(seconds=1))
        self.assertLessEqual(duracion, timedelta(hours=2))

    def test_overdue_loan_blocks_new_requests(self):
        Prestamo.objects.create(
            libro=self.libro,
            usuario=self.user,
            fecha_vencimiento=timezone.now() - timedelta(days=1),
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('catalogo:solicitar', args=[self.libro.pk]),
            {'tipo': Prestamo.TipoPrestamo.NORMAL},
            follow=True,
        )

        self.assertContains(response, 'Tienes un libro atrasado')
        self.assertEqual(Prestamo.objects.filter(usuario=self.user).count(), 1)
        self.libro.refresh_from_db()
        self.assertEqual(self.libro.ejemplares_disponibles, 1)

    def test_returned_overdue_loan_does_not_block_new_requests(self):
        Prestamo.objects.create(
            libro=self.libro,
            usuario=self.user,
            fecha_vencimiento=timezone.now() - timedelta(days=1),
            devuelto=True,
        )
        self.client.force_login(self.user)

        self.client.post(
            reverse('catalogo:solicitar', args=[self.libro.pk]),
            {'tipo': Prestamo.TipoPrestamo.NORMAL},
        )

        self.assertEqual(Prestamo.objects.filter(usuario=self.user).count(), 2)

    def test_registering_return_restores_available_copy(self):
        prestamo = Prestamo.objects.create(
            libro=self.libro,
            usuario=self.user,
        )
        Libro.objects.filter(pk=self.libro.pk).update(
            ejemplares_disponibles=0,
        )
        prestamo.devuelto = True
        admin_model = PrestamoAdmin(Prestamo, admin.site)

        admin_model.save_model(
            RequestFactory().post('/admin/catalogo/prestamo/'),
            prestamo,
            form=None,
            change=True,
        )

        self.libro.refresh_from_db()
        self.assertEqual(self.libro.ejemplares_disponibles, 1)

    def test_loan_request_rejects_unknown_type(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('catalogo:solicitar', args=[self.libro.pk]),
            {'tipo': 'invalido'},
            follow=True,
        )

        self.assertContains(response, 'Selecciona un tipo de préstamo válido')
        self.assertFalse(Prestamo.objects.exists())
        self.libro.refresh_from_db()
        self.assertEqual(self.libro.ejemplares_disponibles, 1)

    def test_loan_form_explains_reservation_restrictions(self):
        self.client.force_login(self.user)

        response = self.client.get(
            reverse('catalogo:detalle', args=[self.libro.pk]),
        )

        self.assertContains(response, 'Normal (7 días')
        self.assertContains(response, 'Reserva (2 horas')
        self.assertContains(response, 'no puede salir del recinto')

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
