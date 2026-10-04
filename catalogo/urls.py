from django.urls import path

from . import views

app_name = 'catalogo'

urlpatterns = [
    path('', views.PortadaView.as_view(), name='portada'),
    path('buscar/', views.BuscarView.as_view(), name='buscar'),
    path('libro/<int:pk>/', views.LibroDetailView.as_view(), name='detalle'),
    path(
        'libro/<int:pk>/solicitar/',
        views.solicitar_prestamo,
        name='solicitar',
    ),
    path('libro/nuevo/', views.LibroCreateView.as_view(), name='crear'),
    path(
        'libro/<int:pk>/editar/',
        views.LibroUpdateView.as_view(),
        name='editar',
    ),
    path(
        'libro/<int:pk>/eliminar/',
        views.LibroDeleteView.as_view(),
        name='eliminar',
    ),
    path('perfil/', views.perfil, name='perfil'),
    path('registro/', views.RegistroView.as_view(), name='registro'),
]
