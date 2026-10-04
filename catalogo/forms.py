from django import forms

from .models import Libro


class LibroForm(forms.ModelForm):
    class Meta:
        model = Libro
        fields = [
            'autor',
            'titulo',
            'descripcion',
            'anio',
            'ejemplares_disponibles',
            'imagen_url',
            'destacado',
            'publicado',
        ]
        widgets = {
            'titulo': forms.TextInput(attrs={
                'placeholder': 'Ej: Cien años de soledad',
            }),
            'descripcion': forms.Textarea(attrs={'rows': 4}),
            'anio': forms.NumberInput(attrs={'placeholder': '1967'}),
            'imagen_url': forms.URLInput(attrs={
                'placeholder': 'https://...',
            }),
        }
