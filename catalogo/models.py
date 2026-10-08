from datetime import timedelta

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone


class Autor(models.Model):
    nombre = models.CharField(max_length=100)
    biografia = models.TextField(blank=True)

    def __str__(self):
        return self.nombre

    class Meta:
        ordering = ['nombre']


class Libro(models.Model):
    autor = models.ForeignKey(
        Autor,
        on_delete=models.CASCADE,
        related_name='libros',
    )
    titulo = models.CharField(max_length=180)
    descripcion = models.TextField(blank=True)
    anio = models.IntegerField()
    ejemplares_disponibles = models.IntegerField(default=1)
    imagen_url = models.URLField(
        blank=True,
        help_text='Link de la portada (opcional)',
    )
    destacado = models.BooleanField(default=False)
    publicado = models.BooleanField(default=True)

    def __str__(self):
        return self.titulo

    def get_absolute_url(self):
        return reverse('catalogo:detalle', kwargs={'pk': self.pk})

    class Meta:
        ordering = ['-destacado', 'titulo']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ejemplares_disponibles__gte=0),
                name='libro_ejemplares_no_negativos',
            ),
        ]


class Prestamo(models.Model):
    class TipoPrestamo(models.TextChoices):
        NORMAL = 'normal', 'Normal'
        RESERVA = 'reserva', 'Reserva'

    libro = models.ForeignKey(
        Libro,
        on_delete=models.CASCADE,
        related_name='prestamos',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='prestamos',
    )
    tipo = models.CharField(
        max_length=10,
        choices=TipoPrestamo.choices,
        default=TipoPrestamo.NORMAL,
    )
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_vencimiento = models.DateTimeField(blank=True)
    devuelto = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self._state.adding and not self.fecha_vencimiento:
            duracion = (
                timedelta(hours=2)
                if self.tipo == self.TipoPrestamo.RESERVA
                else timedelta(days=7)
            )
            self.fecha_vencimiento = timezone.now() + duracion
        super().save(*args, **kwargs)

    @property
    def vencido(self):
        return not self.devuelto and self.fecha_vencimiento < timezone.now()

    @classmethod
    def usuario_tiene_atrasos(cls, usuario):
        return cls.objects.filter(
            usuario=usuario,
            devuelto=False,
            fecha_vencimiento__lt=timezone.now(),
        ).exists()

    def __str__(self):
        return f'{self.usuario.username} - {self.libro.titulo}'

    class Meta:
        ordering = ['-fecha_solicitud']
