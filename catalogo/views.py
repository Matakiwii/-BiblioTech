from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_POST
from django.views.generic import (
    CreateView,
    DeleteView,
    DetailView,
    ListView,
    UpdateView,
)

from .forms import LibroForm
from .models import Libro, Prestamo


class SoloStaffMixin(UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_staff


class PortadaView(ListView):
    model = Libro
    template_name = 'catalogo/home.html'
    context_object_name = 'libros_destacados'

    def get_queryset(self):
        return Libro.objects.filter(
            publicado=True,
            destacado=True,
        ).select_related('autor')


class BuscarView(ListView):
    model = Libro
    template_name = 'catalogo/buscar.html'
    context_object_name = 'libros'

    def get_queryset(self):
        query = self.request.GET.get('q', '')
        queryset = Libro.objects.filter(
            publicado=True,
        ).select_related('autor')
        if query:
            queryset = queryset.filter(
                Q(titulo__icontains=query)
                | Q(autor__nombre__icontains=query)
            )
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['q'] = self.request.GET.get('q', '')
        return context


class LibroDetailView(DetailView):
    model = Libro
    template_name = 'catalogo/libro_detail.html'
    context_object_name = 'libro'

    def get_queryset(self):
        return Libro.objects.filter(publicado=True).select_related('autor')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['tiene_atrasos'] = (
            self.request.user.is_authenticated
            and Prestamo.usuario_tiene_atrasos(self.request.user)
        )
        return context


@login_required
@require_POST
def solicitar_prestamo(request, pk):
    libro = get_object_or_404(Libro, pk=pk, publicado=True)
    tipo = request.POST.get('tipo', Prestamo.TipoPrestamo.NORMAL)
    if tipo not in Prestamo.TipoPrestamo.values:
        messages.error(request, 'Selecciona un tipo de préstamo válido.')
        return redirect('catalogo:detalle', pk=libro.pk)

    if Prestamo.usuario_tiene_atrasos(request.user):
        messages.error(
            request,
            'No puedes solicitar préstamos mientras tengas un libro atrasado. '
            'Devuelve el libro pendiente para volver a solicitar.',
        )
        return redirect('catalogo:detalle', pk=libro.pk)

    with transaction.atomic():
        ejemplares_actualizados = Libro.objects.filter(
            pk=libro.pk,
            ejemplares_disponibles__gt=0,
        ).update(ejemplares_disponibles=F('ejemplares_disponibles') - 1)
        if ejemplares_actualizados:
            Prestamo.objects.create(
                libro=libro,
                usuario=request.user,
                tipo=tipo,
            )
            messages.success(request, 'Solicitud de préstamo registrada.')
        else:
            messages.error(request, 'No quedan ejemplares disponibles.')
    return redirect('catalogo:detalle', pk=libro.pk)


class LibroCreateView(LoginRequiredMixin, SoloStaffMixin, CreateView):
    model = Libro
    form_class = LibroForm
    template_name = 'catalogo/libro_form.html'


class LibroUpdateView(LoginRequiredMixin, SoloStaffMixin, UpdateView):
    model = Libro
    form_class = LibroForm
    template_name = 'catalogo/libro_form.html'


class LibroDeleteView(LoginRequiredMixin, SoloStaffMixin, DeleteView):
    model = Libro
    template_name = 'catalogo/libro_confirm_delete.html'
    success_url = reverse_lazy('catalogo:portada')


@login_required
def perfil(request):
    query = request.GET.get('q', '')
    prestamos = Prestamo.objects.filter(
        usuario=request.user,
    ).select_related('libro')
    if query:
        prestamos = prestamos.filter(libro__titulo__icontains=query)
    return render(request, 'catalogo/perfil.html', {
        'prestamos': prestamos,
        'q': query,
        'tiene_atrasos': Prestamo.usuario_tiene_atrasos(request.user),
    })


class RegistroView(CreateView):
    form_class = UserCreationForm
    template_name = 'registration/registro.html'
    success_url = reverse_lazy('login')
