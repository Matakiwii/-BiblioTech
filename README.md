# BiblioTech

Aplicación de catálogo de biblioteca con búsqueda, registro e inicio de
sesión, solicitudes de préstamo y administración de libros.

## Versión local sin Django

Para usar la versión sencilla, sin instalar paquetes ni iniciar un servidor:

1. Abre la carpeta `local`.
2. Haz doble clic en `index.html` para abrirlo con Chrome o Edge.
3. La primera vez puedes entrar con el administrador de demostración:
   usuario `admin`, contraseña `biblioteca123`.
4. Cambia la contraseña desde **Mi perfil** y usa la cuenta `admin` para
   administrar libros y devoluciones.

Esta versión funciona en el navegador y guarda los libros, cuentas y préstamos
en el almacenamiento local de ese navegador. No necesita Django ni Python,
pero tampoco sincroniza datos entre navegadores o dispositivos; borrar los
datos del sitio en el navegador puede eliminar la biblioteca local. No la uses
para información sensible ni como sistema de autenticación seguro.

Las cuentas nuevas son lectoras. La cuenta inicial `admin` administra el
catálogo y puede registrar devoluciones. Los préstamos normales vencen a los
7 días; las reservas vencen a las 2 horas y son solo para uso dentro del
recinto. Un usuario con un préstamo vencido no puede solicitar otro hasta que
se registre la devolución.

## Versión Django (opcional)

Los préstamos normales vencen a los 7 días. Los préstamos de reserva vencen
a las 2 horas y son solo para consulta dentro del recinto. Si un usuario tiene
un préstamo vencido y aún no devuelto, no podrá solicitar otro hasta que el
personal registre la devolución en la administración de Django.

## Ejecutar en Windows PowerShell

Por defecto, el proyecto usa SQLite y no necesitas instalar ni configurar
MySQL. Desde la carpeta `biblioteca_django`, ejecuta:

```powershell
.\venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py runserver
```

Abre `http://127.0.0.1:8000/`. Para crear un usuario administrador (o agregar
otro), abre otra terminal en la carpeta `biblioteca_django`, activa el entorno
virtual y ejecuta:

```powershell
.\venv\Scripts\Activate.ps1
python manage.py createsuperuser
```

Sigue las indicaciones para escribir un nombre de usuario, correo (opcional)
y contraseña. Puedes volver a ejecutar el comando para crear más
administradores; cada uno debe tener un nombre de usuario distinto. Inicia
sesión en `http://127.0.0.1:8000/admin/`. El registro público está en
`http://127.0.0.1:8000/registro/`.

La base de datos local se guarda en `db.sqlite3`.

### Usar MySQL (opcional)

Si prefieres MySQL, primero crea la base de datos `biblioteca_django` en
MySQL. En PowerShell, configura MySQL para la terminal actual antes de
ejecutar los comandos de Django:

```powershell
$env:BIBLIOTECA_DB_ENGINE = "mysql"
$secure = Read-Host "Contraseña MySQL" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:BIBLIOTECA_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
python manage.py migrate
python manage.py runserver
```

La contraseña solo permanece en esa ventana de PowerShell y no se guarda en
el proyecto. MySQL usa `root` por defecto; para otro usuario, configura
`BIBLIOTECA_DB_USER`.

Para correr las pruebas automáticas, no necesitas una conexión a MySQL:

```powershell
python manage.py test --settings=config.test_settings
```

## Seguridad

No guardes contraseñas ni tokens en el código ni en GitHub. La clave de Django
de desarrollo es local; define `DJANGO_SECRET_KEY` en el entorno si vas a
desplegar el sitio y cambia `DEBUG` a `False` antes de producción.
