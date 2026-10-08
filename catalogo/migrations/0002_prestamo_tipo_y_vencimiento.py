from datetime import timedelta

from django.db import migrations, models


def completar_vencimientos(apps, schema_editor):
    Prestamo = apps.get_model('catalogo', 'Prestamo')
    prestamos = Prestamo.objects.filter(
        fecha_vencimiento__isnull=True,
    ).iterator()
    lote = []
    for prestamo in prestamos:
        prestamo.fecha_vencimiento = (
            prestamo.fecha_solicitud + timedelta(days=7)
        )
        lote.append(prestamo)
        if len(lote) == 1000:
            Prestamo.objects.bulk_update(lote, ['fecha_vencimiento'])
            lote = []
    if lote:
        Prestamo.objects.bulk_update(lote, ['fecha_vencimiento'])


class Migration(migrations.Migration):

    dependencies = [
        ('catalogo', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='prestamo',
            name='tipo',
            field=models.CharField(
                choices=[('normal', 'Normal'), ('reserva', 'Reserva')],
                default='normal',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='prestamo',
            name='fecha_vencimiento',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(
            completar_vencimientos,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name='prestamo',
            name='fecha_vencimiento',
            field=models.DateTimeField(blank=True),
        ),
    ]
