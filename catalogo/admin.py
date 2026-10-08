from django.contrib import admin
from django.db import transaction
from django.db.models import F

from .models import Autor, Libro, Prestamo


@admin.register(Autor)
class AutorAdmin(admin.ModelAdmin):
    list_display = ('nombre',)
    search_fields = ('nombre',)


@admin.register(Libro)
class LibroAdmin(admin.ModelAdmin):
    list_display = (
        'titulo',
        'autor',
        'anio',
        'ejemplares_disponibles',
        'destacado',
        'publicado',
    )
    list_filter = ('autor', 'destacado', 'publicado')
    search_fields = ('titulo', 'descripcion')


@admin.register(Prestamo)
class PrestamoAdmin(admin.ModelAdmin):
    list_display = (
        'usuario',
        'libro',
        'tipo',
        'fecha_solicitud',
        'fecha_vencimiento',
        'devuelto',
    )
    list_filter = ('tipo', 'devuelto')
    search_fields = ('usuario__username', 'libro__titulo')

    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            prestamo_anterior = None
            if change:
                prestamo_anterior = Prestamo.objects.filter(
                    pk=obj.pk,
                ).values('devuelto', 'libro_id').first()

            super().save_model(request, obj, form, change)

            if (
                prestamo_anterior
                and not prestamo_anterior['devuelto']
                and obj.devuelto
            ):
                Libro.objects.filter(
                    pk=prestamo_anterior['libro_id'],
                ).update(ejemplares_disponibles=F('ejemplares_disponibles') + 1)
