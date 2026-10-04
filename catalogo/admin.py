from django.contrib import admin

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
    list_display = ('usuario', 'libro', 'fecha_solicitud', 'devuelto')
    list_filter = ('devuelto',)
    search_fields = ('usuario__username', 'libro__titulo')
